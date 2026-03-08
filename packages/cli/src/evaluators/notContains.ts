import type { EvalResult } from "../types.js";

export function evalNotContains(output: string, value: string, caseSensitive = true): EvalResult {
  const passed = caseSensitive
    ? !output.includes(value)
    : !output.toLowerCase().includes(value.toLowerCase());
  return {
    type: "not_contains",
    passed,
    detail: passed ? undefined : `Output contains forbidden string "${value}"`,
  };
}
