import type { EvalResult } from "../types.js";

export function evalEndsWith(output: string, value: string, caseSensitive = true): EvalResult {
  const passed = caseSensitive
    ? output.endsWith(value)
    : output.toLowerCase().endsWith(value.toLowerCase());
  return {
    type: "ends_with",
    passed,
    detail: passed ? undefined : `Output does not end with "${value}"`,
  };
}
