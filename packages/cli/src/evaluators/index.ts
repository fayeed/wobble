import type { Expectation, EvalResult } from "../types.js";
import { evalContains } from "./contains.js";
import { evalNotContains } from "./notContains.js";
import { evalMaxLength } from "./maxLength.js";
import { evalRegex } from "./regex.js";
import { evalJsonSchema } from "./jsonSchema.js";
import { evalLlmJudge } from "./llmJudge.js";
import { evalCustom } from "./custom.js";

export async function runEvaluator(
  expectation: Expectation,
  output: string,
  input: string
): Promise<EvalResult> {
  switch (expectation.type) {
    case "contains":
      return evalContains(output, expectation.value as string);
    case "not_contains":
      return evalNotContains(output, expectation.value as string);
    case "max_length":
      return evalMaxLength(output, expectation.value as number);
    case "regex":
      return evalRegex(output, expectation.value as string);
    case "json_schema":
      return evalJsonSchema(output, expectation.schema!);
    case "llm_judge":
      return evalLlmJudge(
        output,
        expectation.criteria!,
        expectation.model,
        expectation.provider
      );
    case "custom":
      return evalCustom(output, input, expectation.evaluator!);
    default: {
      const t = (expectation as Expectation).type;
      return { type: t, passed: false, detail: `Unknown evaluator type: "${t}"` };
    }
  }
}
