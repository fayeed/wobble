import { defineCommand } from "citty";
import fs from "fs";
import path from "path";
import chalk from "chalk";

const WOBBLE_YAML = `\
version: 1

# Default model and provider for all tests (overridable per-test)
model: gpt-4o-mini
provider: openai

# How many times to run each case (for flakiness detection)
runs: 1

# Fraction of runs that must pass (0.0–1.0). Default 1.0 = all runs must pass.
# threshold: 0.8

# Global limits
# limits:
#   max_cost_per_run: 1.00
#   max_tokens_per_case: 1024
#   timeout_per_run: 30000   # ms

tests:
  - id: example
    prompt_file: prompts/example.txt
    cases:
      - input: "What is 2 + 2?"
        expect:
          - type: contains
            value: "4"
          - type: max_length
            value: 200
            unit: chars
`;

const EXAMPLE_PROMPT = `\
You are a helpful assistant. Answer the user's question concisely and accurately.
`;

export const initCommand = defineCommand({
  meta: { name: "init", description: "Scaffold a starter wobble.yaml" },
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
  },
  run({ args }) {
    const configPath = path.resolve(args.config);
    const configDir = path.dirname(configPath);
    const promptsDir = path.join(configDir, "prompts");
    const promptPath = path.join(promptsDir, "example.txt");

    const conflicts: string[] = [];
    if (!args.force) {
      if (fs.existsSync(configPath)) conflicts.push(args.config);
      if (fs.existsSync(promptPath)) conflicts.push(path.relative(configDir, promptPath));
    }

    if (conflicts.length > 0) {
      console.error(
        chalk.red(`  Already exists: ${conflicts.join(", ")}\n`) +
        chalk.dim("  Use --force to overwrite.")
      );
      process.exit(1);
    }

    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(configPath, WOBBLE_YAML, "utf-8");
    fs.writeFileSync(promptPath, EXAMPLE_PROMPT, "utf-8");

    console.log(chalk.green("  Created:"));
    console.log(chalk.green(`    ${args.config}`));
    console.log(chalk.green(`    ${path.relative(configDir, promptPath)}`));
    console.log();
    console.log(chalk.dim("  Next steps:"));
    console.log(chalk.dim(`    1. Set OPENAI_API_KEY in your environment`));
    console.log(chalk.dim(`    2. Edit ${args.config} and prompts/example.txt`));
    console.log(chalk.dim(`    3. wobble run`));
  },
});
