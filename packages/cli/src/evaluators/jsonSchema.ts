import type { EvalResult } from "../types.js";

function extractJson(output: string): unknown {
  // First try raw parse
  try {
    return JSON.parse(output);
  } catch {
    // Fall back: pull out the first {...} or [...] block
    const match = output.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error("no JSON found");
  }
}

export async function evalJsonSchema(
  output: string,
  schema: Record<string, unknown>
): Promise<EvalResult> {
  let parsed: unknown;
  try {
    parsed = extractJson(output);
  } catch {
    return { type: "json_schema", passed: false, detail: "Output is not valid JSON" };
  }

  // Dynamic import handles ESM/CJS interop for AJV
  const mod = await import("ajv");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AjvClass = (mod as any).default?.default ?? (mod as any).default ?? mod;
  const ajv = new AjvClass({ allErrors: true });

  const validate = ajv.compile(schema);
  const valid = validate(parsed);

  if (!valid) {
    const errors = (validate.errors ?? [])
      .map((e: { instancePath: string; message?: string }) =>
        `${e.instancePath || "root"} ${e.message}`
      )
      .join("; ");
    return { type: "json_schema", passed: false, detail: `Schema validation failed: ${errors}` };
  }

  return { type: "json_schema", passed: true };
}
