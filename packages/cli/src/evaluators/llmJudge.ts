import type { EvalResult } from "../types.js";
import { getProvider } from "../providers/index.js";

const SYSTEM = `You are an impartial evaluator. Given an AI-generated response and evaluation criteria, decide if the response meets the criteria.
Reply with ONLY valid JSON: {"pass": true, "reason": "one sentence"}.`;

export async function evalLlmJudge(
  output: string,
  criteria: string,
  model: string | undefined,
  providerName: string | undefined
): Promise<EvalResult> {
  const resolvedModel = model ?? "gpt-4o-mini";
  const resolvedProvider = providerName ?? "openai";

  try {
    const provider = await getProvider(resolvedProvider);

    const response = await provider.run({
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Criteria: ${criteria}\n\nResponse to evaluate:\n${output}\n\nReply with JSON only.`,
        },
      ],
      model: resolvedModel,
      maxTokens: 256,
    });

    let verdict: { pass: boolean; reason?: string };
    try {
      const match = response.content.match(/\{[\s\S]*\}/);
      verdict = match ? JSON.parse(match[0]) : { pass: false, reason: "Could not parse verdict" };
    } catch {
      verdict = { pass: false, reason: "Could not parse verdict" };
    }

    return { type: "llm_judge", passed: verdict.pass, detail: verdict.reason };
  } catch (err) {
    return {
      type: "llm_judge",
      passed: false,
      detail: `Judge error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
