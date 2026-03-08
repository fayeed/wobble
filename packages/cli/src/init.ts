import { defineCommand } from "citty";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import * as readline from "readline";

// ─── Q&A helpers ─────────────────────────────────────────────────────────────

function rl(): readline.Interface {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

async function ask(iface: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => iface.question(question, (a) => resolve(a.trim())));
}

async function confirm(iface: readline.Interface, question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? chalk.dim("Y/n") : chalk.dim("y/N");
  const answer = await ask(iface, `${question} ${hint} `);
  if (answer === "") return defaultYes;
  return /^y/i.test(answer);
}

async function choose(iface: readline.Interface, question: string, options: string[], defaultIndex = 0): Promise<string> {
  const opts = options.map((o, i) => (i === defaultIndex ? chalk.bold(o) : o)).join(chalk.dim(" / "));
  const answer = await ask(iface, `${question} ${chalk.dim(`[${opts}]`)} `);
  const matched = options.find((o) => o.toLowerCase().startsWith(answer.toLowerCase()));
  return matched ?? options[defaultIndex];
}

async function input(iface: readline.Interface, question: string, defaultValue: string): Promise<string> {
  const answer = await ask(iface, `${question} ${chalk.dim(`(${defaultValue})`)} `);
  return answer === "" ? defaultValue : answer;
}

// ─── Config builder ───────────────────────────────────────────────────────────

interface Answers {
  provider: string;
  model: string;
  runs: number;
  threshold: number | null;
  concurrency: number | null;
  maxCost: number | null;
  timeoutMs: number | null;
  multiTurn: boolean;
  llmJudge: boolean;
  flakiness: boolean;
}

function envVarForProvider(provider: string): string {
  if (provider === "anthropic") return "ANTHROPIC_API_KEY";
  if (provider === "google") return "GOOGLE_API_KEY";
  return "OPENAI_API_KEY";
}

function modelForProvider(provider: string): string {
  if (provider === "anthropic") return "claude-haiku-4-5-20251001";
  if (provider === "google") return "gemini-2.0-flash";
  return "gpt-4o-mini";
}

function buildConfig(answers: Answers, promptFile: string): string {
  const lines: string[] = [];

  lines.push("version: 1", "");
  lines.push(`model: ${answers.model}`);
  lines.push(`provider: ${answers.provider}`);
  lines.push("");

  if (answers.flakiness) {
    lines.push(`runs: ${answers.runs}`);
    if (answers.threshold !== null) {
      lines.push(`threshold: ${answers.threshold}`);
    }
    if (answers.concurrency !== null) {
      lines.push(`concurrency: ${answers.concurrency}`);
    }
    lines.push("");
  }

  const hasLimits = answers.maxCost !== null || answers.timeoutMs !== null;
  if (hasLimits) {
    lines.push("limits:");
    if (answers.maxCost !== null) lines.push(`  max_cost_per_run: ${answers.maxCost}`);
    if (answers.timeoutMs !== null) lines.push(`  timeout_per_run: ${answers.timeoutMs}`);
    lines.push("");
  }

  lines.push("tests:");
  lines.push(`  - id: example`);
  lines.push(`    prompt_file: ${promptFile}`);
  lines.push(`    cases:`);

  if (answers.multiTurn) {
    lines.push(`      - turns:`);
    lines.push(`          - role: user`);
    lines.push(`            content: "Hello, who are you?"`);
    lines.push(`          - role: assistant`);
    lines.push(`            content: "I'm a helpful assistant. How can I help you?"`);
    lines.push(`          - role: user`);
    lines.push(`            content: "What is 2 + 2?"`);
    lines.push(`        expect:`);
    lines.push(`          - type: contains`);
    lines.push(`            value: "4"`);
    if (answers.llmJudge) {
      lines.push(`          - type: llm_judge`);
      lines.push(`            criteria: "The response correctly answers the math question and is concise."`);
    }
  } else {
    lines.push(`      - input: "What is 2 + 2?"`);
    lines.push(`        expect:`);
    lines.push(`          - type: contains`);
    lines.push(`            value: "4"`);
    lines.push(`          - type: max_length`);
    lines.push(`            value: 200`);
    lines.push(`            unit: chars`);
    if (answers.llmJudge) {
      lines.push(`          - type: llm_judge`);
      lines.push(`            criteria: "The response correctly answers the math question and is concise."`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function buildPrompt(multiTurn: boolean): string {
  if (multiTurn) {
    return "You are a helpful assistant. Engage naturally with the user across multiple turns.\n";
  }
  return "You are a helpful assistant. Answer the user's question concisely and accurately.\n";
}

// ─── Command ──────────────────────────────────────────────────────────────────

export const initCommand = defineCommand({
  meta: { name: "init", description: "Scaffold a starter wobble.yaml via interactive Q&A" },
  args: {
    config: {
      type: "string",
      description: "Path for the generated config file",
      default: "wobble.yaml",
      alias: "c",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing files",
      default: false,
      alias: "f",
    },
    yes: {
      type: "boolean",
      description: "Accept all defaults without prompting",
      default: false,
      alias: "y",
    },
  },
  async run({ args }) {
    const configPath = path.resolve(args.config);
    const configDir = path.dirname(configPath);
    const promptsDir = path.join(configDir, "prompts");
    const promptFile = "prompts/example.txt";
    const promptPath = path.join(configDir, promptFile);

    // Conflict check
    const conflicts: string[] = [];
    if (!args.force) {
      if (fs.existsSync(configPath)) conflicts.push(args.config);
      if (fs.existsSync(promptPath)) conflicts.push(promptFile);
    }
    if (conflicts.length > 0) {
      console.error(
        chalk.red(`  Already exists: ${conflicts.join(", ")}\n`) +
        chalk.dim("  Use --force to overwrite.")
      );
      process.exit(1);
    }

    // Defaults
    const answers: Answers = {
      provider: "openai",
      model: "gpt-4o-mini",
      runs: 5,
      threshold: 0.8,
      concurrency: 5,
      maxCost: null,
      timeoutMs: 30000,
      multiTurn: false,
      llmJudge: false,
      flakiness: false,
    };

    if (!args.yes) {
      const iface = rl();
      console.log(chalk.bold("\n  wobble init\n"));

      // Provider + model
      answers.provider = await choose(iface, "Provider?", ["openai", "anthropic", "google"]);
      answers.model = await input(iface, "Model?", modelForProvider(answers.provider));

      // Flakiness / N-runs
      answers.flakiness = await confirm(iface, "Enable N-runs flakiness detection?", false);
      if (answers.flakiness) {
        const runsStr = await input(iface, "  Runs per case?", "5");
        answers.runs = Math.max(1, parseInt(runsStr, 10) || 5);
        const threshStr = await input(iface, "  Pass threshold (0.0–1.0)?", "0.8");
        answers.threshold = Math.min(1, Math.max(0, parseFloat(threshStr) || 0.8));
        const concStr = await input(iface, "  Concurrency?", "5");
        answers.concurrency = Math.max(1, parseInt(concStr, 10) || 5);
      } else {
        answers.runs = 1;
        answers.threshold = null;
        answers.concurrency = null;
      }

      // Multi-turn
      answers.multiTurn = await confirm(iface, "Include a multi-turn conversation example?", false);

      // LLM judge
      answers.llmJudge = await confirm(iface, "Include an llm_judge evaluator example?", false);

      // Cost guardrail
      const wantCost = await confirm(iface, "Set a max cost per run guardrail?", false);
      if (wantCost) {
        const costStr = await input(iface, "  Max cost (USD)?", "1.00");
        answers.maxCost = parseFloat(costStr) || 1.0;
      } else {
        answers.maxCost = null;
      }

      // Timeout
      const wantTimeout = await confirm(iface, "Set a per-run timeout?", true);
      answers.timeoutMs = wantTimeout ? 30000 : null;
      if (wantTimeout) {
        const msStr = await input(iface, "  Timeout (ms)?", "30000");
        answers.timeoutMs = parseInt(msStr, 10) || 30000;
      }

      iface.close();
      console.log();
    }

    // Write files
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(configPath, buildConfig(answers, promptFile), "utf-8");
    fs.writeFileSync(promptPath, buildPrompt(answers.multiTurn), "utf-8");

    console.log(chalk.green("  Created:"));
    console.log(chalk.green(`    ${args.config}`));
    console.log(chalk.green(`    ${promptFile}`));
    console.log();
    console.log(chalk.dim("  Next steps:"));
    console.log(chalk.dim(`    1. Set ${envVarForProvider(answers.provider)} in your environment`));
    console.log(chalk.dim(`    2. Edit ${args.config} and ${promptFile}`));
    console.log(chalk.dim(`    3. wobble run`));
  },
});
