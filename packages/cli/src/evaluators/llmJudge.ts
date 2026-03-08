import type { EvalResult, Expectation } from "../types.js";
import { getProvider } from "../providers/index.js";

// ─── Pass/fail mode ───────────────────────────────────────────────────────────

const PASSFAIL_SYSTEM = `You are an impartial evaluator. Given an AI-generated response and evaluation criteria, decide if the response meets the criteria.
Reply with ONLY valid JSON: {"pass": true, "reason": "one sentence explaining your decision"}.`;

// ─── Rubric mode ──────────────────────────────────────────────────────────────

function buildRubricSystem(dimensions: string[]): string {
  const dims = dimensions.map((d) => `  - "${d}": score 1-10`).join("\n");
  return `You are an impartial evaluator. Score the response on each dimension from 1 (very poor) to 10 (excellent).
Reply with ONLY valid JSON in this exact shape:
{
  "scores": {
${dims}
  },
  "reasoning": "one paragraph explaining all scores"
}`;
}

function buildRubricUserMessage(criteria: string, output: string, dimensions: string[]): string {
  return `Evaluation criteria: ${criteria}

Dimensions to score: ${dimensions.join(", ")}

Response to evaluate:
${output}

Reply with JSON only.`;
}

// ─── Few-shot examples ────────────────────────────────────────────────────────

function buildExamplesBlock(examples: NonNullable<Expectation["examples"]>): string {
  const parts = examples.map((ex, i) => {
    const verdict = ex.pass ? "PASS" : "FAIL";
    const reason = ex.reason ? `\nReason: ${ex.reason}` : "";
    return `Example ${i + 1}:
Input: ${ex.input}
Response: ${ex.output}
Verdict: ${verdict}${reason}`;
  });
  return `\n\nCalibration examples (use these to calibrate your scoring):\n${parts.join("\n\n")}`;
}

// ─── Main evaluator ───────────────────────────────────────────────────────────

export async function evalLlmJudge(
  output: string,
  criteria: string,
  model: string | undefined,
  providerName: string | undefined,
  rubric?: Expectation["rubric"],
  scoreThreshold?: number,
  examples?: Expectation["examples"]
): Promise<EvalResult> {
  const resolvedModel = model ?? "gpt-4o-mini";
  const resolvedProvider = providerName ?? "openai";
  const examplesBlock = examples && examples.length > 0 ? buildExamplesBlock(examples) : "";

  try {
    const provider = await getProvider(resolvedProvider);

    // ── Rubric mode ──
    if (rubric && rubric.length > 0) {
      const dimensions = rubric.map((r) => r.dimension);
      const passThreshold = scoreThreshold ?? 7;

      const system = buildRubricSystem(dimensions) + examplesBlock;
      const userMsg = buildRubricUserMessage(criteria, output, dimensions);

      const response = await provider.run({
        system,
        messages: [{ role: "user", content: userMsg }],
        model: resolvedModel,
        maxTokens: 512,
      });

      let parsed: { scores: Record<string, number>; reasoning?: string };
      try {
        const match = response.content.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { scores: {} };
      } catch {
        return { type: "llm_judge", passed: false, detail: "Could not parse rubric scores" };
      }

      // Compute weighted average
      let weightedSum = 0;
      let totalWeight = 0;
      const scores: NonNullable<EvalResult["scores"]> = [];

      for (const r of rubric) {
        const score = parsed.scores?.[r.dimension] ?? 0;
        const weight = r.weight ?? 1;
        weightedSum += score * weight;
        totalWeight += weight;
        scores.push({ dimension: r.dimension, score, weight });
      }

      const weightedAvg = totalWeight > 0 ? weightedSum / totalWeight : 0;
      const passed = weightedAvg >= passThreshold;

      const scoreStr = scores.map((s) => `${s.dimension}: ${s.score}/10`).join(", ");
      const detail = `Weighted score: ${weightedAvg.toFixed(1)}/${passThreshold} — ${scoreStr}`;

      return {
        type: "llm_judge",
        passed,
        detail,
        reasoning: parsed.reasoning,
        scores,
      };
    }

    // ── Pass/fail mode ──
    const system = PASSFAIL_SYSTEM + examplesBlock;
    const userContent =
      `Criteria: ${criteria}\n\nResponse to evaluate:\n${output}\n\nReply with JSON only.`;

    const response = await provider.run({
      system,
      messages: [{ role: "user", content: userContent }],
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

    return {
      type: "llm_judge",
      passed: verdict.pass,
      detail: verdict.reason,
      reasoning: verdict.reason,
    };
  } catch (err) {
    return {
      type: "llm_judge",
      passed: false,
      detail: `Judge error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
