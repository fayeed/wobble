import { defineCommand } from "citty";
import chalk from "chalk";
import path from "path";
import { loadHistory, overallTrend, evalTrend, findFirstFailure } from "./history.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function bar(rate: number, width = 10): string {
  const filled = Math.round(rate * width);
  const empty = width - filled;
  return chalk.green("█".repeat(filled)) + chalk.dim("░".repeat(empty));
}

// ─── Subcommands ──────────────────────────────────────────────────────────────

const historyListCommand = defineCommand({
  meta: { name: "list", description: "Show overall pass-rate trend across all runs" },
  args: {
    history: {
      type: "string",
      description: "Path to history file",
      default: ".wobble/history.jsonl",
    },
    last: {
      type: "string",
      description: "Show last N runs (default: all)",
    },
    json: {
      type: "boolean",
      description: "Output raw JSON",
      default: false,
    },
  },
  async run({ args }) {
    const entries = loadHistory(args.history);
    if (entries.length === 0) {
      console.log(chalk.dim("  No history found. Run `wobble run` to record a run."));
      return;
    }

    const limit = args.last ? parseInt(args.last, 10) : undefined;
    const sliced = limit ? entries.slice(-limit) : entries;
    const trend = overallTrend(sliced);

    if (args.json) {
      process.stdout.write(JSON.stringify(trend, null, 2) + "\n");
      return;
    }

    console.log(chalk.bold("\n  Run history\n"));
    console.log(
      chalk.dim("  " + "Date".padEnd(22) + "Pass rate".padEnd(14) + "Passed".padEnd(10) + "Failed".padEnd(10) + "Cost")
    );
    console.log(chalk.dim("  " + "─".repeat(62)));

    for (const point of trend) {
      const dateStr = fmtDate(point.runAt).padEnd(22);
      const barStr = bar(point.passRate);
      const pctStr = pct(point.passRate).padStart(5);
      const passedStr = chalk.green(String(point.passed)).padEnd(10);
      const failedStr = (point.failed > 0 ? chalk.red(String(point.failed)) : chalk.dim("0")).padEnd(10);
      const costStr = chalk.dim(`~$${point.cost.toFixed(4)}`);
      console.log(`  ${dateStr}${barStr} ${pctStr}  ${passedStr}${failedStr}${costStr}`);
    }
    console.log();
  },
});

const historyShowCommand = defineCommand({
  meta: { name: "show", description: "Show trend for a specific eval check" },
  args: {
    history: {
      type: "string",
      description: "Path to history file",
      default: ".wobble/history.jsonl",
    },
    test: {
      type: "string",
      description: "Test ID to inspect",
      alias: "t",
      required: true,
    },
    input: {
      type: "string",
      description: "Input string to inspect",
      alias: "i",
      required: true,
    },
    eval: {
      type: "string",
      description: "Eval type to inspect (e.g. contains, llm_judge)",
      alias: "e",
      required: true,
    },
    last: {
      type: "string",
      description: "Show last N runs",
    },
    json: {
      type: "boolean",
      description: "Output raw JSON",
      default: false,
    },
  },
  async run({ args }) {
    const entries = loadHistory(args.history);
    if (entries.length === 0) {
      console.log(chalk.dim("  No history found."));
      return;
    }

    const limit = args.last ? parseInt(args.last, 10) : undefined;
    const sliced = limit ? entries.slice(-limit) : entries;

    const trend = evalTrend(sliced, args.test, args.input, args.eval);

    if (trend.length === 0) {
      console.log(chalk.dim(`  No data found for test="${args.test}" input="${args.input}" eval="${args.eval}"`));
      return;
    }

    if (args.json) {
      process.stdout.write(JSON.stringify(trend, null, 2) + "\n");
      return;
    }

    console.log(chalk.bold(`\n  ${args.test} › "${args.input}" › ${args.eval}\n`));
    console.log(
      chalk.dim("  " + "Date".padEnd(22) + "Pass rate".padEnd(14) + "Runs")
    );
    console.log(chalk.dim("  " + "─".repeat(46)));

    for (const point of trend) {
      const dateStr = fmtDate(point.runAt).padEnd(22);
      const barStr = bar(point.passRate);
      const pctStr = pct(point.passRate).padStart(5);
      const runsStr = chalk.dim(`  ${point.passCount}/${point.totalRuns}`);
      const icon = point.passed ? chalk.green("✓") : chalk.red("✗");
      console.log(`  ${dateStr}${barStr} ${pctStr}  ${icon}${runsStr}`);
    }

    // First-failure detection
    const firstFail = findFirstFailure(entries, args.test, args.input, args.eval);
    if (firstFail) {
      console.log(
        chalk.yellow(`\n  ⚠ First regression detected at: ${fmtDate(firstFail.runAt)}`)
      );
    }

    console.log();
  },
});

// ─── Root history command ──────────────────────────────────────────────────────

export const historyCommand = defineCommand({
  meta: { name: "history", description: "View run history and trends" },
  args: {
    history: {
      type: "string",
      description: "Path to history file",
      default: ".wobble/history.jsonl",
    },
    last: {
      type: "string",
      description: "Show last N runs",
    },
    json: {
      type: "boolean",
      description: "Output raw JSON",
      default: false,
    },
  },
  subCommands: {
    show: historyShowCommand,
  },
  // Default behaviour (no subcommand): show overall trend
  async run({ args }) {
    const entries = loadHistory(args.history);
    if (entries.length === 0) {
      console.log(chalk.dim("  No history found. Run `wobble run` to record a run."));
      return;
    }

    const limit = args.last ? parseInt(args.last, 10) : undefined;
    const sliced = limit ? entries.slice(-limit) : entries;
    const trend = overallTrend(sliced);

    if (args.json) {
      process.stdout.write(JSON.stringify(trend, null, 2) + "\n");
      return;
    }

    console.log(chalk.bold("\n  Run history\n"));
    console.log(
      chalk.dim("  " + "Date".padEnd(22) + "Pass rate".padEnd(14) + "Passed".padEnd(10) + "Failed".padEnd(10) + "Cost")
    );
    console.log(chalk.dim("  " + "─".repeat(62)));

    for (const point of trend) {
      const dateStr = fmtDate(point.runAt).padEnd(22);
      const barStr = bar(point.passRate);
      const pctStr = pct(point.passRate).padStart(5);
      const passedStr = chalk.green(String(point.passed)).padEnd(10);
      const failedStr = (point.failed > 0 ? chalk.red(String(point.failed)) : chalk.dim("0")).padEnd(10);
      const costStr = chalk.dim(`~$${point.cost.toFixed(4)}`);
      console.log(`  ${dateStr}${barStr} ${pctStr}  ${passedStr}${failedStr}${costStr}`);
    }
    console.log();
  },
});
