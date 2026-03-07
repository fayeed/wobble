import type { EvalResult } from "../types.js";

export function evalNotContains(output: string, value: string): EvalResult {
  const passed = !output.includes(value);
  return {
    type: "not_contains",
    passed,
    detail: passed ? undefined : `Output contains forbidden string "${value}"`,
  };
}
