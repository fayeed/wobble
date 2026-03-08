import chalk from "chalk";
import type { EvalResult } from "../types.js";

export function printTestHeader(id: string): void {
  console.log("\n" + chalk.bold(id));
}

export function printEvalRow(opts: {
  input: string;
  eval: EvalResult;
  passCount: number;
  totalRuns: number;
  passed: boolean;
}): void {
  const { input, eval: e, passCount, totalRuns, passed } = opts;

  const icon = passed
    ? chalk.green("✓")
    : passCount === 0
    ? chalk.red("✗")
    : chalk.yellow("~");

  const runsLabel =
    totalRuns > 1
      ? chalk.dim(` (${passCount}/${totalRuns})`)
      : "";

  const inputSnip =
    input.length > 55 ? input.slice(0, 52) + "..." : input;

  const evalLabel = chalk.cyan(e.type);

  console.log(`  ${icon} ${chalk.dim(`"${inputSnip}"`)} ${evalLabel}${runsLabel}`);

  if (!passed && e.detail) {
    console.log(chalk.red(`      ${e.detail}`));
  }
}

export function printGuardrailAbort(estimated: number, limit: number): void {
  console.log();
  console.log(chalk.red.bold("✗ Run aborted — projected cost exceeds guardrail limit"));
  console.log(
    chalk.red(`  Estimated: $${estimated.toFixed(4)}  ·  Limit: $${limit.toFixed(2)}`)
  );
  console.log(chalk.dim("  Update limits.max_cost_per_run in wobble.yaml to continue."));
  console.log();
}

export function printSummary(opts: {
  passed: number;
  failed: number;
  totalCost: number;
}): void {
  const { passed, failed, totalCost } = opts;
  const passStr = chalk.green(`${passed} passed`);
  const failStr = failed > 0 ? chalk.red(`${failed} failed`) : chalk.dim("0 failed");
  const costStr = totalCost > 0 ? chalk.dim(`  ·  ~$${totalCost.toFixed(4)}`) : "";
  console.log(`\n${passStr}  ·  ${failStr}${costStr}\n`);
}

export function printRunError(testId: string, message: string): void {
  console.log("\n" + chalk.bold(testId));
  console.log(chalk.red(`  Error: ${message}`));
}

export function printRegressions(regressions: Array<{ testId: string; input: string; evalType: string }>): void {
  if (regressions.length === 0) return;
  console.log(chalk.red.bold(`\n${regressions.length} regression${regressions.length === 1 ? "" : "s"} vs baseline:`));
  for (const r of regressions) {
    console.log(chalk.red(`  ✗ ${r.testId}  ${chalk.dim(`"${r.input.length > 55 ? r.input.slice(0, 52) + "..." : r.input}"`)}  ${chalk.cyan(r.evalType)}`));
  }
}

export function printBaselineWritten(path: string): void {
  console.log(chalk.dim(`  Baseline written → ${path}`));
}
