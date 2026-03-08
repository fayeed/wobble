import chalk from "chalk";
import type {
  WobbleConfig,
  TestDefinition,
  CaseResult,
  RunResult,
  EvalResult,
  TokenUsage,
} from "./types.js";
import { loadPrompt, resolveTestModel, resolveTestProvider, resolveTestRuns, resolveTestThreshold, resolveTestConcurrency } from "./config.js";
import { getProvider, buildMessages } from "./providers/index.js";
import { runEvaluator } from "./evaluators/index.js";
import { estimateCostForTokens, estimateTokens, estimateRunCost } from "./cost.js";
import {
  printTestHeader,
  printEvalRow,
  printSummary,
  printRunError,
  printGuardrailAbort,
} from "./output/terminal.js";

export interface RunnerOptions {
  config: WobbleConfig;
  testFilter?: string;
  tagFilter?: string;
  verbose?: boolean;
  silent?: boolean;
}

export interface RunnerResult {
  passed: number;
  failed: number;
  totalCost: number;
  hasFailures: boolean;
  results: RunResult[];
}

export async function runTests(options: RunnerOptions): Promise<RunnerResult> {
  const { config, testFilter, tagFilter, verbose, silent } = options;

  let tests = config.tests;
  if (testFilter) {
    tests = tests.filter((t) => t.id === testFilter);
    if (!tests.length) throw new Error(`No test found with id: "${testFilter}"`);
  }
  if (tagFilter) {
    tests = tests.filter((t) => t.tags?.includes(tagFilter));
    if (!tests.length) throw new Error(`No tests found with tag: "${tagFilter}"`);
  }

  // --- Cost guardrail: estimate before touching any API ---
  if (config.limits?.max_cost_per_run !== undefined) {
    const estimated = estimateTotalCost(tests, config);
    if (estimated > config.limits.max_cost_per_run) {
      if (!silent) printGuardrailAbort(estimated, config.limits.max_cost_per_run);
      process.exit(1);
    }
  }

  let totalPassed = 0;
  let totalFailed = 0;
  let totalCost = 0;
  const allResults: RunResult[] = [];

  for (const test of tests) {
    if (!silent) printTestHeader(test.id);

    let promptContent: string;
    try {
      promptContent = loadPrompt(test.prompt_file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!silent) printRunError(test.id, msg);
      allResults.push({ testId: test.id, caseResults: [], error: msg });
      totalFailed++;
      continue;
    }

    const model = resolveTestModel(test, config);
    const providerName = resolveTestProvider(test, config);
    const runs = resolveTestRuns(test, config);
    const concurrency = resolveTestConcurrency(test, config);
    const threshold = resolveTestThreshold(test, config);
    const requiredPasses = Math.ceil(threshold * runs);
    const maxTokens = config.limits?.max_tokens_per_case;
    const timeoutMs = config.limits?.timeout_per_run;

    const runResult: RunResult = { testId: test.id, caseResults: [] };

    for (let ci = 0; ci < test.cases.length; ci++) {
      const testCase = test.cases[ci];
      const caseModel = testCase.model ?? model;
      const caseProviderName = testCase.provider ?? providerName;
      const caseProvider = await getProvider(caseProviderName);

      const { system, messages } = buildMessages(
        promptContent,
        testCase.input,
        testCase.turns
      );

      const inputLabel =
        testCase.input ??
        testCase.turns?.filter((m) => m.role === "user").pop()?.content ??
        "(multi-turn)";

      // passCounts[evalIdx] = number of runs that passed
      const passCounts: number[] = new Array(testCase.expect.length).fill(0);
      let errorCount = 0;
      let lastEvals: EvalResult[] = [];
      let lastOutput = "";
      const totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

      // Run trials concurrently up to `concurrency` at a time
      type TrialResult = { runIndex: number; output: string; evals: EvalResult[]; usage: TokenUsage } | { runIndex: number; error: string };

      async function runTrial(runIndex: number): Promise<TrialResult> {
        try {
          const resp = await caseProvider.run({ system, messages, model: caseModel, maxTokens, timeoutMs });
          const evals = await Promise.all(
            testCase.expect.map((exp) => runEvaluator(exp, resp.content, inputLabel, { model: caseModel, provider: caseProviderName }))
          );
          return { runIndex, output: resp.content, evals, usage: resp.usage };
        } catch (err) {
          return { runIndex, error: err instanceof Error ? err.message : String(err) };
        }
      }

      const trialResults: TrialResult[] = [];
      const queue = Array.from({ length: runs }, (_, i) => i);
      const inFlight = new Set<Promise<void>>();

      async function startNext(): Promise<void> {
        const runIndex = queue.shift();
        if (runIndex === undefined) return;
        const p: Promise<void> = runTrial(runIndex).then((result) => {
          trialResults.push(result);
          inFlight.delete(p);
        });
        inFlight.add(p);
      }

      // Seed up to `concurrency` tasks
      for (let i = 0; i < Math.min(concurrency, runs); i++) {
        await startNext();
      }
      // Drain: as each finishes, start the next queued one
      while (inFlight.size > 0) {
        await Promise.race(inFlight);
        await startNext();
      }

      // Aggregate in run-index order for stable lastEvals / lastOutput
      trialResults.sort((a, b) => a.runIndex - b.runIndex);

      for (const result of trialResults) {
        if ("error" in result) {
          if (!silent) console.log(chalk.red(`  Error on run ${result.runIndex + 1}: ${result.error}`));
          errorCount++;
          continue;
        }
        if (verbose && !silent) {
          console.log(chalk.dim(`  [run ${result.runIndex + 1}] ${result.output.slice(0, 160)}`));
        }
        lastOutput = result.output;
        lastEvals = result.evals;
        totalUsage.inputTokens += result.usage.inputTokens;
        totalUsage.outputTokens += result.usage.outputTokens;
        for (let ei = 0; ei < result.evals.length; ei++) {
          if (result.evals[ei].passed) passCounts[ei]++;
        }
      }

      // Print one row per evaluator
      // Errors count as failed runs: denominator stays `runs`, pass threshold is against all attempts
      for (let ei = 0; ei < testCase.expect.length; ei++) {
        const e = lastEvals[ei] ?? { type: testCase.expect[ei].type, passed: false };
        const passed = passCounts[ei] >= requiredPasses;
        if (!silent) printEvalRow({ input: inputLabel, eval: e, passCount: passCounts[ei], totalRuns: runs, errorCount, passed });

        if (passed) totalPassed++;
        else totalFailed++;
      }

      const caseCost = estimateCostForTokens(caseModel, totalUsage.inputTokens, totalUsage.outputTokens);
      totalCost += caseCost;

      runResult.caseResults.push({
        caseIndex: ci,
        input: inputLabel,
        output: lastOutput,
        evals: lastEvals.map((e, i) => ({ ...e, passed: passCounts[i] >= requiredPasses, passCount: passCounts[i], totalRuns: runs })),
        tokenUsage: totalUsage,
      } satisfies CaseResult);
    }

    allResults.push(runResult);
  }

  if (!silent) printSummary({ passed: totalPassed, failed: totalFailed, totalCost });

  return {
    passed: totalPassed,
    failed: totalFailed,
    totalCost,
    hasFailures: totalFailed > 0,
    results: allResults,
  };
}

function estimateTotalCost(tests: TestDefinition[], config: WobbleConfig): number {
  let total = 0;
  for (const test of tests) {
    const model = resolveTestModel(test, config);
    const runs = resolveTestRuns(test, config);
    const maxOutputTokens = config.limits?.max_tokens_per_case ?? 512;

    let systemTokens = 500; // fallback if file can't be read yet
    try {
      systemTokens = estimateTokens(loadPrompt(test.prompt_file));
    } catch { /* ignore */ }

    for (const c of test.cases) {
      let inputTokens: number;
      if (c.turns && c.turns.length > 0) {
        // Sum all turn content; multi-turn history accumulates in the context window
        inputTokens = c.turns.reduce((sum, t) => sum + estimateTokens(t.content), 0);
      } else {
        inputTokens = estimateTokens(c.input ?? "");
      }
      total += estimateRunCost({ model, systemTokens, inputTokens, maxOutputTokens, runs });
    }
  }
  return total;
}
