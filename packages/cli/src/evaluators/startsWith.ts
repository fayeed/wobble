import type { EvalResult } from "../types.js";

export function evalStartsWith(output: string, value: string, caseSensitive = true): EvalResult {
  const passed = caseSensitive
    ? output.startsWith(value)
    : output.toLowerCase().startsWith(value.toLowerCase());
  return {
    type: "starts_with",
    passed,
    detail: passed ? undefined : `Output does not start with "${value}"`,
  };
}
