import path from "path";
import type { Provider } from "../types.js";

// Cache loaded custom providers by resolved path
const cache = new Map<string, Provider>();

export async function loadCustomProvider(providerPath: string): Promise<Provider> {
  const absPath = path.resolve(providerPath);

  if (cache.has(absPath)) return cache.get(absPath)!;

  let mod: unknown;
  try {
    mod = await import(absPath);
  } catch (e) {
    throw new Error(
      `Failed to load custom provider at "${providerPath}": ${e instanceof Error ? e.message : String(e)}`
    );
  }

  // Accept default export or named `provider` export
  const provider =
    (mod as Record<string, unknown>)["default"] ??
    (mod as Record<string, unknown>)["provider"];

  if (!provider || typeof (provider as Record<string, unknown>)["run"] !== "function") {
    throw new Error(
      `Custom provider at "${providerPath}" must export a default object (or named "provider") with a run() method.\n` +
        `Expected: export default { async run({ system, messages, model, maxTokens, timeoutMs }) { ... } }`
    );
  }

  cache.set(absPath, provider as Provider);
  return provider as Provider;
}
