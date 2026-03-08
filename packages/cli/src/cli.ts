import { defineCommand } from "citty";
import { loadConfig } from "./config.js";
import { runTests } from "./runner.js";
import { writeBaseline, loadBaseline, findRegressions } from "./baseline.js";
import { printRegressions, printBaselineWritten } from "./output/terminal.js";

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
      default: ".wobble-baseline.json",
    },
    output: {
      type: "string",
      description: "Output format: 'terminal' (default) or 'json'",
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
    const existingBaseline = args["write-baseline"] ? null : loadBaseline(baselinePath);

    try {
      const result = await runTests({
        config,
        testFilter: args.test,
        tagFilter: args.tag,
        verbose: args.verbose,
        silent: jsonMode,
      });

      if (args["write-baseline"]) {
        writeBaseline(result.results, baselinePath);
        if (!jsonMode) printBaselineWritten(baselinePath);
        process.exit(result.hasFailures ? 1 : 0);
      }

      const regressions = existingBaseline
        ? findRegressions(existingBaseline, result.results)
        : [];

      if (jsonMode) {
        process.stdout.write(JSON.stringify({
          passed: result.passed,
          failed: result.failed,
          totalCost: result.totalCost,
          hasFailures: result.hasFailures,
          regressions,
          results: result.results,
        }, null, 2) + "\n");
        process.exit(result.hasFailures || regressions.length > 0 ? 1 : 0);
      }

      if (existingBaseline) {
        printRegressions(regressions);
        process.exit(result.hasFailures || regressions.length > 0 ? 1 : 0);
      }

      process.exit(result.hasFailures ? 1 : 0);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  },
});
