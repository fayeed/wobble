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
      const stream = await getClient().messages.stream({
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

      let content = "";
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          content += chunk.delta.text;
          process.stderr.write(".");
        }
      }
      process.stderr.write("\n");

      const finalMessage = await stream.finalMessage();

      return {
        content,
        usage: {
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
        },
      };
    });
  },
};
