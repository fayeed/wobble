import type { EvalResult } from "../types.js";

export function evalContains(output: string, value: string, caseSensitive = true): EvalResult {
  const passed = caseSensitive
    ? output.includes(value)
    : output.toLowerCase().includes(value.toLowerCase());
  return {
    type: "contains",
    passed,
    detail: passed ? undefined : `Output does not contain "${value}"`,
  };
}
