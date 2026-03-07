import path from "path";
import type { EvalResult } from "../types.js";

export interface CustomEvaluator {
  evaluate(output: string, input: string): EvalResult | Promise<EvalResult>;
}

const cache = new Map<string, CustomEvaluator>();

export async function evalCustom(
  output: string,
  input: string,
  evaluatorPath: string
): Promise<EvalResult> {
  const absPath = path.resolve(evaluatorPath);

  let evaluator = cache.get(absPath);
  if (!evaluator) {
    let mod: unknown;
    try {
      mod = await import(absPath);
    } catch (e) {
      return {
        type: "custom",
        passed: false,
        detail: `Failed to load evaluator at "${evaluatorPath}": ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    const candidate =
      (mod as Record<string, unknown>)["default"] ??
      (mod as Record<string, unknown>)["evaluator"] ??
      mod;

    if (typeof (candidate as Record<string, unknown>)["evaluate"] !== "function") {
      return {
        type: "custom",
        passed: false,
        detail:
          `Custom evaluator at "${evaluatorPath}" must export an object with evaluate(output, input). ` +
          `Expected: export default { evaluate(output, input) { return { passed, detail } } }`,
      };
    }

    evaluator = candidate as CustomEvaluator;
    cache.set(absPath, evaluator);
  }

  try {
    const result = await evaluator.evaluate(output, input);
    return { ...result, type: "custom" };
  } catch (e) {
    return {
      type: "custom",
      passed: false,
      detail: `Evaluator threw: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
