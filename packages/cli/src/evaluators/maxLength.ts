import type { EvalResult } from "../types.js";

export function evalMaxLength(output: string, limit: number, unit: "chars" | "words" = "chars"): EvalResult {
  const measured =
    unit === "words"
      ? output.trim().split(/\s+/).filter(Boolean).length
      : output.length;
  const passed = measured <= limit;
  return {
    type: "max_length",
    passed,
    detail: passed ? undefined : `Output ${unit === "words" ? "word count" : "length"} ${measured} exceeds limit of ${limit} ${unit}`,
  };
}
