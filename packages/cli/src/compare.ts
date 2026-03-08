import { defineCommand } from "citty";
import chalk from "chalk";
import { loadConfig } from "./config.js";
import { runTests, type RunnerResult } from "./runner.js";

// ─── Target parsing ───────────────────────────────────────────────────────────

interface Target {
  label: string;
  provider: string;
  model: string;
}

/**
 * Parse "provider:model" or "model" shorthand.
 * Examples:
 *   openai:gpt-4o          → { provider: "openai",    model: "gpt-4o" }
 *   anthropic:claude-sonnet-4-6 → { provider: "anthropic", model: "claude-sonnet-4-6" }
 *   gpt-4o-mini            → { provider: "openai",    model: "gpt-4o-mini" }   (inferred)
 */
function parseTarget(raw: string): Target {
  const colon = raw.indexOf(":");
  if (colon > 0) {
    const provider = raw.slice(0, colon);
    const model = raw.slice(colon + 1);
    return { label: raw, provider, model };
  }
  // Infer provider from model name prefix
  let provider = "openai";
  if (raw.startsWith("claude")) provider = "anthropic";
  else if (raw.startsWith("gemini")) provider = "google";
  return { label: raw, provider, model: raw };
}

// ─── Table rendering ──────────────────────────────────────────────────────────

interface CompareRow {
  testId: string;
  input: string;
  evalType: string;
  results: Array<{ passRate: number; passed: boolean; cost: number } | null>;
}

function buildRows(targets: Target[], runs: Array<RunnerResult | null>): CompareRow[] {
  // Collect all (testId, input, evalType) keys in order from first successful run
  const keyOrder: string[] = [];
  const keySet = new Set<string>();

  for (const run of runs) {
    if (!run) continue;
    for (const r of run.results) {
      for (const c of r.caseResults) {
        for (const e of c.evals) {
          const key = `${r.testId}::${c.input}::${e.type}`;
          if (!keySet.has(key)) {
            keySet.add(key);
            keyOrder.push(key);
          }
        }
      }
    }
    break; // first successful run determines structure
  }

  return keyOrder.map((key) => {
    const [testId, input, evalType] = key.split("::");
    const rowResults = runs.map((run) => {
      if (!run) return null;
      for (const r of run.results) {
        if (r.testId !== testId) continue;
        for (const c of r.caseResults) {
          if (c.input !== input) continue;
          for (const e of c.evals) {
            if (e.type !== evalType) continue;
            const passCount = e.passCount ?? (e.passed ? 1 : 0);
            const totalRuns = e.totalRuns ?? 1;
            return {
              passRate: totalRuns > 0 ? passCount / totalRuns : 0,
              passed: e.passed,
              cost: 0, // will be filled per-target below
            };
          }
        }
      }
      return null;
    });
    return { testId, input, evalType, results: rowResults };
  });
}

function pad(s: string, width: number): string {
  return s.length >= width ? s.slice(0, width) : s + " ".repeat(width - s.length);
}

function stripAnsi(s: string): number {
  // approximate visible length by stripping ANSI escape codes
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function padVisible(s: string, width: number): string {
  const visible = stripAnsi(s);
  const extra = Math.max(0, width - visible);
  return s + " ".repeat(extra);
}

function printCompareTable(
  targets: Target[],
  rows: CompareRow[],
  costs: number[],
  totalPassed: number[],
  totalFailed: number[]
): void {
  const COL_LABEL = 52;
  const COL_TARGET = 18;

  // Header
  const targetCols = targets.map((t) => pad(t.label, COL_TARGET));
  console.log(
    "\n" +
    pad("", COL_LABEL) +
    targetCols.map((c) => chalk.bold(c)).join("")
  );
  console.log(chalk.dim("─".repeat(COL_LABEL + COL_TARGET * targets.length)));

  let lastTestId = "";

  for (const row of rows) {
    if (row.testId !== lastTestId) {
      console.log(chalk.bold(`\n${row.testId}`));
      lastTestId = row.testId;
    }

    const inputSnip = row.input.length > 35 ? row.input.slice(0, 32) + "..." : row.input;
    const label = `  ${chalk.dim(`"${inputSnip}"`)} ${chalk.cyan(row.evalType)}`;

    const cells = row.results.map((r) => {
      if (r === null) return padVisible(chalk.dim("  —"), COL_TARGET);
      const pct = Math.round(r.passRate * 100);
      const icon = r.passed
        ? chalk.green("✓")
        : r.passRate === 0
        ? chalk.red("✗")
        : chalk.yellow("~");
      const rate = r.passRate < 1 && r.passRate > 0
        ? chalk.dim(` ${pct}%`)
        : "";
      return padVisible(`  ${icon}${rate}`, COL_TARGET);
    });

    console.log(padVisible(label, COL_LABEL) + cells.join(""));
  }

  // Summary row
  console.log("\n" + chalk.dim("─".repeat(COL_LABEL + COL_TARGET * targets.length)));
  const passRow = pad("  pass / fail", COL_LABEL) +
    targets.map((_, i) => {
      const p = totalPassed[i] ?? 0;
      const f = totalFailed[i] ?? 0;
      const cell = `${chalk.green(String(p))}/${chalk.red(String(f))}`;
      return padVisible(`  ${cell}`, COL_TARGET);
    }).join("");
  console.log(passRow);

  const costRow = pad("  cost (est.)", COL_LABEL) +
    costs.map((c) => pad(`  ~$${c.toFixed(4)}`, COL_TARGET)).join("");
  console.log(chalk.dim(costRow));
  console.log();
}

// ─── Command ──────────────────────────────────────────────────────────────────

export const compareCommand = defineCommand({
  meta: { name: "compare", description: "Run tests across multiple models and compare results" },
  args: {
    config: {
      type: "string",
      description: "Path to wobble.yaml",
      default: "wobble.yaml",
      alias: "c",
    },
    targets: {
      type: "string",
      description: "Comma-separated list of provider:model targets, e.g. openai:gpt-4o,anthropic:claude-haiku-4-5-20251001",
      alias: "m",
    },
    test: {
      type: "string",
      description: "Run a single test by id",
      alias: "t",
    },
    tag: {
      type: "string",
      description: "Run tests matching a tag",
    },
    output: {
      type: "string",
      description: "Output format: 'terminal' (default) or 'json'",
      default: "terminal",
      alias: "o",
    },
  },
  async run({ args }) {
    if (!args.targets) {
      console.error(chalk.red("  --targets is required. Example: --targets openai:gpt-4o,anthropic:claude-sonnet-4-6"));
      process.exit(1);
    }

    let baseConfig;
    try {
      baseConfig = loadConfig(args.config);
    } catch (err) {
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }

    const targets = args.targets.split(",").map((t) => parseTarget(t.trim())).filter((t) => t.model);

    if (targets.length < 2) {
      console.error(chalk.red("  At least two targets are required for comparison."));
      process.exit(1);
    }

    const jsonMode = args.output === "json";
    if (!jsonMode) {
      console.log(chalk.dim(`\n  Comparing ${targets.length} targets across ${baseConfig.tests.length} test(s)…`));
    }

    // Run all targets concurrently — they're independent
    const runPromises = targets.map(async (target) => {
      // Clone config and override model + provider globally
      const config = {
        ...baseConfig,
        model: target.model,
        provider: target.provider,
        // Clear per-test overrides so all tests use the target model
        tests: baseConfig.tests.map((t) => ({
          ...t,
          model: undefined,
          provider: undefined,
          // Also clear per-case overrides
          cases: t.cases.map((c) => ({ ...c, model: undefined, provider: undefined })),
        })),
      };
      try {
        return await runTests({ config, testFilter: args.test, tagFilter: args.tag, silent: true });
      } catch {
        return null;
      }
    });

    const runs = await Promise.all(runPromises);

    const rows = buildRows(targets, runs);
    const costs = runs.map((r) => r?.totalCost ?? 0);
    const totalPassed = runs.map((r) => r?.passed ?? 0);
    const totalFailed = runs.map((r) => r?.failed ?? 0);

    if (jsonMode) {
      const output = {
        targets: targets.map((t, i) => ({
          label: t.label,
          provider: t.provider,
          model: t.model,
          passed: totalPassed[i],
          failed: totalFailed[i],
          cost: costs[i],
          results: runs[i]?.results ?? null,
        })),
        rows: rows.map((row) => ({
          testId: row.testId,
          input: row.input,
          evalType: row.evalType,
          results: row.results,
        })),
      };
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
      const anyFail = runs.some((r) => r?.hasFailures);
      process.exit(anyFail ? 1 : 0);
    }

    printCompareTable(targets, rows, costs, totalPassed, totalFailed);

    const anyFail = runs.some((r) => r?.hasFailures);
    process.exit(anyFail ? 1 : 0);
  },
});
