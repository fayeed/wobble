import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "./retry.js";
import type { Provider, ProviderRunOptions, ProviderResponse } from "../types.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    client = new Anthropic({ apiKey });
  }
  return client;
}

export const anthropicProvider: Provider = {
  async run(options: ProviderRunOptions): Promise<ProviderResponse> {
    return withRetry(async () => {
      const response = await getClient().messages.create({
        model: options.model,
        system: options.system,
        max_tokens: options.maxTokens ?? 1024,
        messages: options.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
      });

      const content = response.content.find((b) => b.type === "text")?.text ?? "";

      return {
        content,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    });
  },
};
