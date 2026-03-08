import { GoogleGenAI } from "@google/genai";
import { withRetry } from "./retry.js";
import type { Provider, ProviderRunOptions, ProviderResponse } from "../types.js";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env["GOOGLE_API_KEY"] ?? process.env["GEMINI_API_KEY"];
    if (!apiKey)
      throw new Error(
        "GOOGLE_API_KEY (or GEMINI_API_KEY) environment variable is not set"
      );
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export const googleProvider: Provider = {
  async run(options: ProviderRunOptions): Promise<ProviderResponse> {
    return withRetry(async () => {
      const genai = getClient();

      const contents = options.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const response = await genai.models.generateContent({
        model: options.model,
        contents,
        config: {
          systemInstruction: options.system,
          maxOutputTokens: options.maxTokens,
        },
      });

      const content = response.text ?? "";
      const usage = response.usageMetadata;

      return {
        content,
        usage: {
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: usage?.candidatesTokenCount ?? 0,
        },
      };
    });
  },
};
