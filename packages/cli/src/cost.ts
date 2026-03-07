// Pricing per 1M tokens (input, output) in USD — as of early 2026
// Unknown models fall back to DEFAULT_PRICING so cost guardrails still work.
const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4o":             { input: 2.5,  output: 10.0 },
  "gpt-4o-mini":        { input: 0.15, output: 0.6  },
  "gpt-4.1":            { input: 2.0,  output: 8.0  },
  "gpt-4.1-mini":       { input: 0.4,  output: 1.6  },
  "gpt-4-turbo":        { input: 10.0, output: 30.0 },
  "o1":                 { input: 15.0, output: 60.0 },
  "o1-mini":            { input: 3.0,  output: 12.0 },
  // Anthropic
  "claude-opus-4-6":               { input: 15.0, output: 75.0 },
  "claude-sonnet-4-6":             { input: 3.0,  output: 15.0 },
  "claude-haiku-4-5-20251001":     { input: 0.8,  output: 4.0  },
  "claude-3-5-sonnet-20241022":    { input: 3.0,  output: 15.0 },
  "claude-3-5-haiku-20241022":     { input: 0.8,  output: 4.0  },
  "claude-3-opus-20240229":        { input: 15.0, output: 75.0 },
  // Google
  "gemini-2.0-flash":              { input: 0.1,  output: 0.4  },
  "gemini-2.0-flash-lite":         { input: 0.075, output: 0.3 },
  "gemini-1.5-pro":                { input: 1.25, output: 5.0  },
  "gemini-1.5-flash":              { input: 0.075, output: 0.3 },
};

const DEFAULT_PRICING = { input: 5.0, output: 15.0 };

export function estimateCostForTokens(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const p = PRICING[model] ?? DEFAULT_PRICING;
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

/** Rough estimate: ~4 chars per token */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateRunCost(opts: {
  model: string;
  systemTokens: number;
  inputTokens: number;
  maxOutputTokens: number;
  runs: number;
}): number {
  const p = PRICING[opts.model] ?? DEFAULT_PRICING;
  const inputCost = ((opts.systemTokens + opts.inputTokens) / 1_000_000) * p.input;
  const outputCost = (opts.maxOutputTokens / 1_000_000) * p.output;
  return (inputCost + outputCost) * opts.runs;
}
