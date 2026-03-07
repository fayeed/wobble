import type { EvalResult } from "../types.js";

export function evalRegex(output: string, pattern: string): EvalResult {
  try {
    const passed = new RegExp(pattern).test(output);
    return {
      type: "regex",
      passed,
      detail: passed ? undefined : `Output does not match pattern /${pattern}/`,
    };
  } catch {
    return { type: "regex", passed: false, detail: `Invalid regex: ${pattern}` };
  }
}
