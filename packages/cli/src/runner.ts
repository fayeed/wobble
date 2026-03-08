import chalk from "chalk";
import type {
  WobbleConfig,
  TestDefinition,
  CaseResult,
  RunResult,
  EvalResult,
  TokenUsage,
} from "./types.js";
import { loadPrompt, resolveTestModel, resolveTestProvider, resolveTestRuns, resolveTestThreshold } from "./config.js";
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
}

export interface RunnerResult {
  passed: number;
  failed: number;
  totalCost: number;
  hasFailures: boolean;
  results: RunResult[];
}

export async function runTests(options: RunnerOptions): Promise<RunnerResult> {
  const { config, testFilter, tagFilter, verbose } = options;

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
      printGuardrailAbort(estimated, config.limits.max_cost_per_run);
      process.exit(1);
    }
  }

  let totalPassed = 0;
  let totalFailed = 0;
  let totalCost = 0;
  const allResults: RunResult[] = [];

  for (const test of tests) {
    printTestHeader(test.id);

    let promptContent: string;
    try {
      promptContent = loadPrompt(test.prompt_file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      printRunError(test.id, msg);
      allResults.push({ testId: test.id, caseResults: [], error: msg });
      totalFailed++;
      continue;
    }

    const model = resolveTestModel(test, config);
    const providerName = resolveTestProvider(test, config);
    const runs = resolveTestRuns(test, config);
    const threshold = resolveTestThreshold(test, config);
    const requiredPasses = Math.ceil(threshold * runs);
    const maxTokens = config.limits?.max_tokens_per_case;

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
      let lastEvals: EvalResult[] = [];
      let lastOutput = "";
      const totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

      for (let run = 0; run < runs; run++) {
        let output: string;
        try {
          const resp = await caseProvider.run({
            system,
            messages,
            model: caseModel,
            maxTokens,
          });
          output = resp.content;
          totalUsage.inputTokens += resp.usage.inputTokens;
          totalUsage.outputTokens += resp.usage.outputTokens;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(chalk.red(`  Error on run ${run + 1}: ${msg}`));
          continue;
        }

        lastOutput = output;

        if (verbose) {
          console.log(chalk.dim(`  [run ${run + 1}] ${output.slice(0, 160)}`));
        }

        const evals = await Promise.all(
          testCase.expect.map((exp) => runEvaluator(exp, output, inputLabel))
        );

        if (run === runs - 1) lastEvals = evals;

        for (let ei = 0; ei < evals.length; ei++) {
          if (evals[ei].passed) passCounts[ei]++;
        }
      }

      // Print one row per evaluator
      for (let ei = 0; ei < testCase.expect.length; ei++) {
        const e = lastEvals[ei] ?? { type: testCase.expect[ei].type, passed: false };
        const passed = passCounts[ei] >= requiredPasses;
        printEvalRow({ input: inputLabel, eval: e, passCount: passCounts[ei], totalRuns: runs, passed });

        if (passed) totalPassed++;
        else totalFailed++;
      }

      const caseCost = estimateCostForTokens(caseModel, totalUsage.inputTokens, totalUsage.outputTokens);
      totalCost += caseCost;

      runResult.caseResults.push({
        caseIndex: ci,
        input: inputLabel,
        output: lastOutput,
        evals: lastEvals.map((e, i) => ({ ...e, passed: passCounts[i] >= requiredPasses })),
        tokenUsage: totalUsage,
      } satisfies CaseResult);
    }

    allResults.push(runResult);
  }

  printSummary({ passed: totalPassed, failed: totalFailed, totalCost });

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
      const inputTokens = estimateTokens(c.input ?? "");
      total += estimateRunCost({ model, systemTokens, inputTokens, maxOutputTokens, runs });
    }
  }
  return total;
}
