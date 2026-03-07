import type { EvalResult } from "../types.js";

export function evalContains(output: string, value: string): EvalResult {
  const passed = output.includes(value);
  return {
    type: "contains",
    passed,
    detail: passed ? undefined : `Output does not contain "${value}"`,
  };
}
