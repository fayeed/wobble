// Provider is an open string so users can specify "openai", "anthropic",
// "google", or "custom" (pointing to a plugin file) without being locked
// to a hardcoded union.
export type ProviderName = string;

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface Expectation {
  type:
    | "contains"
    | "not_contains"
    | "max_length"
    | "regex"
    | "json_schema"
    | "llm_judge"
    | "custom";
  // contains / not_contains / regex
  value?: string | number;
  // contains / not_contains
  case_sensitive?: boolean;
  // max_length
  unit?: "chars" | "words";
  // json_schema
  schema?: Record<string, unknown>;
  // llm_judge
  criteria?: string;
  model?: string;
  provider?: ProviderName;
  // custom evaluator
  evaluator?: string;
}

export interface TestCase {
  // Simple single-turn
  input?: string;
  // Multi-turn conversation
  turns?: Message[];
  expect: Expectation[];
  // Per-case overrides
  model?: string;
  provider?: ProviderName;
}

export interface TestDefinition {
  id: string;
  prompt_file: string;
  model?: string;
  provider?: ProviderName;
  runs?: number;
  concurrency?: number;
  threshold?: number;
  tags?: string[];
  cases: TestCase[];
}

export interface Limits {
  max_cost_per_run?: number;
  max_tokens_per_case?: number;
  timeout_per_run?: number;
}

export interface WobbleConfig {
  version: number;
  model?: string;
  provider?: ProviderName;
  runs?: number;
  concurrency?: number;
  threshold?: number;
  env?: Record<string, string>;
  limits?: Limits;
  tests: TestDefinition[];
}

// --- Runtime result types ---

export interface EvalResult {
  type: string;
  passed: boolean;
  detail?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CaseResult {
  caseIndex: number;
  input: string;
  output: string;
  evals: EvalResult[];
  tokenUsage: TokenUsage;
}

export interface RunResult {
  testId: string;
  caseResults: CaseResult[];
  error?: string;
}

// --- Provider interface ---

export interface ProviderRunOptions {
  system: string;
  messages: Message[];
  model: string;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface ProviderResponse {
  content: string;
  usage: TokenUsage;
}

export interface Provider {
  run(options: ProviderRunOptions): Promise<ProviderResponse>;
}
