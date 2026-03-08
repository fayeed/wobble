import { defineCommand } from "citty";
import chalk from "chalk";
import { loadConfig } from "./config.js";
import { runTests } from "./runner.js";
import { writeBaseline, loadBaseline } from "./baseline.js";
import { printBaselineWritten } from "./output/terminal.js";

const BASELINE_DEFAULT = ".wobble/baseline.json";

// wobble baseline approve
// Runs tests and promotes the results as the new baseline.
const approveCommand = defineCommand({
  meta: { name: "approve", description: "Run tests and save results as the new baseline" },
  args: {
    config: {
      type: "string",
      description: "Path to wobble.yaml",
      default: "wobble.yaml",
      alias: "c",
    },
    test: {
      type: "string",
      description: "Approve a single test by id",
      alias: "t",
    },
    tag: {
      type: "string",
      description: "Approve tests matching a tag",
    },
    baseline: {
      type: "string",
      description: "Path to baseline file",
      default: BASELINE_DEFAULT,
    },
    verbose: {
      type: "boolean",
      description: "Print model output for each run",
      alias: "v",
      default: false,
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

    let result;
    try {
      result = await runTests({
        config,
        testFilter: args.test,
        tagFilter: args.tag,
        verbose: args.verbose,
      });
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    writeBaseline(result.results, args.baseline);
    printBaselineWritten(args.baseline);
    // Always exit 0 — approving records current state regardless of pass/fail
    process.exit(0);
  },
});

// wobble baseline show
// Prints the stored baseline entries without running any tests.
const showCommand = defineCommand({
  meta: { name: "show", description: "Print the stored baseline" },
  args: {
    baseline: {
      type: "string",
      description: "Path to baseline file",
      default: BASELINE_DEFAULT,
    },
    json: {
      type: "boolean",
      description: "Output raw JSON",
      default: false,
    },
  },
  run({ args }) {
    const baseline = loadBaseline(args.baseline);
    if (!baseline) {
      console.error(chalk.red(`  No baseline found at ${args.baseline}`));
      console.error(chalk.dim("  Run: wobble baseline approve"));
      process.exit(1);
    }

    if (args.json) {
      process.stdout.write(JSON.stringify(baseline, null, 2) + "\n");
      return;
    }

    const entries = Object.entries(baseline.entries);
    if (entries.length === 0) {
      console.log(chalk.dim("  Baseline is empty."));
      return;
    }

    if (baseline.writtenAt) {
      console.log(chalk.dim(`\n  Baseline written ${baseline.writtenAt}`));
    }

    // Group by testId for readable output
    const byTest = new Map<string, typeof entries>();
    for (const entry of entries) {
      const [key] = entry;
      const testId = key.split("::")[0];
      if (!byTest.has(testId)) byTest.set(testId, []);
      byTest.get(testId)!.push(entry);
    }

    for (const [testId, testEntries] of byTest) {
      console.log("\n" + chalk.bold(testId));
      for (const [key, rec] of testEntries) {
        const parts = key.split("::");
        const input = parts[1] ?? "";
        const evalType = parts[2] ?? rec.evalType;
        const rate = `${rec.passCount}/${rec.totalRuns}`;
        const pct = Math.round(rec.passRate * 100);
        const icon = rec.passRate >= 1 ? chalk.green("✓") : rec.passRate === 0 ? chalk.red("✗") : chalk.yellow("~");
        const inputSnip = input.length > 55 ? input.slice(0, 52) + "..." : input;
        console.log(`  ${icon} ${chalk.dim(`"${inputSnip}"`)} ${chalk.cyan(evalType)} ${chalk.dim(`${rate} (${pct}%)`)}`);
      }
    }
    console.log();
  },
});

// wobble baseline <subcommand>
export const baselineCommand = defineCommand({
  meta: { name: "baseline", description: "Manage the regression baseline" },
  subCommands: {
    approve: approveCommand,
    show: showCommand,
  },
});
