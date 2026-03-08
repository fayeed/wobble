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
      const stream = await getClient().chat.completions.create({
        model: options.model,
        max_tokens: options.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: "system", content: options.system },
          ...options.messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
      });

      let content = "";
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          content += delta;
          process.stderr.write(".");
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens;
          outputTokens = chunk.usage.completion_tokens;
        }
      }
      process.stderr.write("\n");

      return {
        content,
        usage: { inputTokens, outputTokens },
      };
    });
  },
};
