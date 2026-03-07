import OpenAI from "openai";
import { withRetry } from "./retry.js";
import type { Provider, ProviderRunOptions, ProviderResponse } from "../types.js";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new Error("OPENAI_API_KEY environment variable is not set");
    client = new OpenAI({ apiKey });
  }
  return client;
}

export const openaiProvider: Provider = {
  async run(options: ProviderRunOptions): Promise<ProviderResponse> {
    return withRetry(async () => {
      const response = await getClient().chat.completions.create({
        model: options.model,
        max_tokens: options.maxTokens,
        messages: [
          { role: "system", content: options.system },
          ...options.messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
      });

      return {
        content: response.choices[0]?.message?.content ?? "",
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        },
      };
    });
  },
};
