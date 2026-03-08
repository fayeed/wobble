import { defineCommand } from "citty";
import { loadConfig } from "./config.js";
import { runTests } from "./runner.js";
import { writeBaseline, loadBaseline, compareBaseline } from "./baseline.js";
import { printBaselineComparison, printBaselineWritten } from "./output/terminal.js";
import { buildJUnit } from "./output/junit.js";
import { appendHistory } from "./history.js";
import path from "path";

export const runCommand = defineCommand({
  meta: { name: "run", description: "Run prompt regression tests" },
  args: {
    config: {
      type: "string",
      description: "Path to wobble.yaml",
      default: "wobble.yaml",
      alias: "c",
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
    verbose: {
      type: "boolean",
      description: "Print model output for each run",
      alias: "v",
      default: false,
    },
    "write-baseline": {
      type: "boolean",
      description: "Save results as the new baseline for regression comparison",
      default: false,
    },
    baseline: {
      type: "string",
      description: "Path to baseline file",
      default: ".wobble/baseline.json",
    },
    output: {
      type: "string",
      description: "Output format: 'terminal' (default), 'json', or 'junit'",
      default: "terminal",
      alias: "o",
    },
  },
  async run({ args }) {
    let config;
    try {
      config = loadConfig(args.config);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    const baselinePath = args.baseline;
    const jsonMode = args.output === "json";
    const junitMode = args.output === "junit";
    const existingBaseline = args["write-baseline"] ? null : loadBaseline(baselinePath);

    try {
      const result = await runTests({
        config,
        testFilter: args.test,
        tagFilter: args.tag,
        verbose: args.verbose,
        silent: jsonMode || junitMode,
      });

      // Always record to history (unconditional, before baseline comparison)
      const historyPath = path.join(path.dirname(baselinePath), "history.jsonl");
      appendHistory(result.results, result.passed, result.failed, result.totalCost, historyPath);

      if (args["write-baseline"]) {
        writeBaseline(result.results, baselinePath);
        if (!jsonMode && !junitMode) printBaselineWritten(baselinePath);
        // Always exit 0 after writing — the point is to record current state
        process.exit(0);
      }

      const regressionThreshold = config.limits?.regression_threshold ?? 0.05;
      const comparison = existingBaseline
        ? compareBaseline(existingBaseline, result.results, regressionThreshold)
        : null;
      const regressions = comparison?.regressions ?? [];

      if (jsonMode) {
        process.stdout.write(JSON.stringify({
          passed: result.passed,
          failed: result.failed,
          totalCost: result.totalCost,
          hasFailures: result.hasFailures,
          regressions,
          improvements: comparison?.improvements ?? [],
          newChecks: comparison?.newChecks ?? [],
          removedChecks: comparison?.removedChecks ?? [],
          results: result.results,
        }, null, 2) + "\n");
        process.exit(result.hasFailures || regressions.length > 0 ? 1 : 0);
      }

      if (junitMode) {
        process.stdout.write(buildJUnit({
          results: result.results,
          regressions,
          passed: result.passed,
          failed: result.failed,
          totalCost: result.totalCost,
        }));
        process.exit(result.hasFailures || regressions.length > 0 ? 1 : 0);
      }

      if (comparison) {
        printBaselineComparison(comparison);
        process.exit(result.hasFailures || regressions.length > 0 ? 1 : 0);
      }

      process.exit(result.hasFailures ? 1 : 0);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  },
});
