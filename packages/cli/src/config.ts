import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { z } from "zod";
import type { WobbleConfig } from "./types.js";

// provider is an open string — "openai" | "anthropic" | "google" | "./my-provider.js"
const ProviderSchema = z.string().min(1);

const ExpectationSchema = z.union([
  z.object({ type: z.literal("contains"), value: z.string(), case_sensitive: z.boolean().optional() }),
  z.object({ type: z.literal("not_contains"), value: z.string(), case_sensitive: z.boolean().optional() }),
  z.object({ type: z.literal("starts_with"), value: z.string(), case_sensitive: z.boolean().optional() }),
  z.object({ type: z.literal("ends_with"), value: z.string(), case_sensitive: z.boolean().optional() }),
  z.object({ type: z.literal("max_length"), value: z.number().positive(), unit: z.enum(["chars", "words"]).optional() }),
  z.object({ type: z.literal("regex"), value: z.string() }),
  z.object({ type: z.literal("json_schema"), schema: z.record(z.unknown()) }),
  z.object({
    type: z.literal("llm_judge"),
    criteria: z.string(),
    model: z.string().optional(),
    provider: ProviderSchema.optional(),
  }),
  z.object({ type: z.literal("custom"), evaluator: z.string() }),
]);

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const TestCaseSchema = z
  .object({
    input: z.string().optional(),
    turns: z.array(MessageSchema).optional(),
    expect: z.array(ExpectationSchema),
    model: z.string().optional(),
    provider: ProviderSchema.optional(),
  })
  .refine((c) => c.input !== undefined || (c.turns && c.turns.length > 0), {
    message: "Each case must have either 'input' or 'turns'",
  });

const TestDefinitionSchema = z.object({
  id: z.string().min(1),
  prompt_file: z.string(),
  model: z.string().optional(),
  provider: ProviderSchema.optional(),
  runs: z.number().positive().int().optional(),
  concurrency: z.number().positive().int().optional(),
  threshold: z.number().min(0).max(1).optional(),
  tags: z.array(z.string()).optional(),
  cases: z.array(TestCaseSchema).min(1),
});

const WobbleConfigSchema = z.object({
  version: z.literal(1),
  model: z.string().optional(),
  provider: ProviderSchema.optional(),
  runs: z.number().positive().int().optional(),
  concurrency: z.number().positive().int().optional(),
  threshold: z.number().min(0).max(1).optional(),
  env: z.record(z.string()).optional(),
  limits: z
    .object({
      max_cost_per_run: z.number().positive().optional(),
      max_tokens_per_case: z.number().positive().int().optional(),
      timeout_per_run: z.number().positive().int().optional(),
    })
    .optional(),
  tests: z.array(TestDefinitionSchema).min(1),
});

function interpolateEnvVars(value: string): string {
  return value.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_, name: string) => {
    return process.env[name] ?? "";
  });
}

function resolveEnvBlock(env: Record<string, string>): void {
  for (const [key, val] of Object.entries(env)) {
    process.env[key] = interpolateEnvVars(val);
  }
}

export function loadConfig(configPath: string): WobbleConfig {
  const absPath = path.resolve(configPath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`Config file not found: ${absPath}`);
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(fs.readFileSync(absPath, "utf-8"));
  } catch (e) {
    throw new Error(
      `Failed to parse YAML: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const result = WobbleConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid wobble.yaml:\n${issues}`);
  }

  const config = result.data as WobbleConfig;

  // Apply env block before anything else so API keys etc. are available
  if (config.env) resolveEnvBlock(config.env);

  // Resolve prompt_file paths relative to the config file's directory
  const configDir = path.dirname(absPath);
  for (const test of config.tests) {
    test.prompt_file = path.resolve(configDir, test.prompt_file);
  }

  return config;
}

export function loadPrompt(promptFile: string): string {
  if (!fs.existsSync(promptFile)) {
    throw new Error(`Prompt file not found: ${promptFile}`);
  }
  return fs.readFileSync(promptFile, "utf-8").trim();
}

export function resolveTestModel(
  test: WobbleConfig["tests"][number],
  config: WobbleConfig
): string {
  return test.model ?? config.model ?? "gpt-4o";
}

export function resolveTestProvider(
  test: WobbleConfig["tests"][number],
  config: WobbleConfig
): string {
  return test.provider ?? config.provider ?? "openai";
}

export function resolveTestRuns(
  test: WobbleConfig["tests"][number],
  config: WobbleConfig
): number {
  return test.runs ?? config.runs ?? 10;
}

export function resolveTestThreshold(
  test: WobbleConfig["tests"][number],
  config: WobbleConfig
): number {
  return test.threshold ?? config.threshold ?? 1.0;
}

export function resolveTestConcurrency(
  test: WobbleConfig["tests"][number],
  config: WobbleConfig
): number {
  return test.concurrency ?? config.concurrency ?? 5;
}
