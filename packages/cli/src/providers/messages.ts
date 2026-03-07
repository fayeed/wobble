import type { Message } from "../types.js";

/**
 * Build the system prompt and messages array from a test case.
 * Handles both single-input and multi-turn cases.
 * If a `system` role message appears inside `turns`, it overrides the prompt file.
 */
export function buildMessages(
  systemPrompt: string,
  caseInput: string | undefined,
  caseTurns: Message[] | undefined
): { system: string; messages: Message[] } {
  if (caseTurns && caseTurns.length > 0) {
    const systemOverride = caseTurns.find((m) => m.role === "system")?.content;
    const messages = caseTurns.filter((m) => m.role !== "system");
    return { system: systemOverride ?? systemPrompt, messages };
  }

  return {
    system: systemPrompt,
    messages: [{ role: "user", content: caseInput! }],
  };
}
