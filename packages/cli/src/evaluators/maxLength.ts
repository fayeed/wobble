import type { EvalResult } from "../types.js";

export function evalMaxLength(output: string, limit: number): EvalResult {
  const len = output.length;
  const passed = len <= limit;
  return {
    type: "max_length",
    passed,
    detail: passed ? undefined : `Output length ${len} exceeds limit of ${limit} chars`,
  };
}
