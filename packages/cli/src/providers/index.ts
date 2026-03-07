import type { Provider } from "../types.js";
import { openaiProvider } from "./openai.js";
import { anthropicProvider } from "./anthropic.js";
import { googleProvider } from "./google.js";
import { loadCustomProvider } from "./custom.js";

export { buildMessages } from "./messages.js";

/**
 * Resolve a provider by name string.
 * Built-ins: "openai" | "anthropic" | "google"
 * Custom:    any string starting with "." or "/" is treated as a file path
 *            to a JS module that exports a Provider-compatible object.
 */
export async function getProvider(name: string): Promise<Provider> {
  switch (name) {
    case "openai":
      return openaiProvider;
    case "anthropic":
      return anthropicProvider;
    case "google":
      return googleProvider;
    default:
      // Treat as a path to a custom provider module
      if (name.startsWith(".") || name.startsWith("/")) {
        return loadCustomProvider(name);
      }
      throw new Error(
        `Unknown provider: "${name}". ` +
          `Built-ins: openai, anthropic, google. ` +
          `For a custom provider pass a relative path, e.g. ./my-provider.js`
      );
  }
}
