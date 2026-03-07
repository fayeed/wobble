import { defineCommand } from "citty";
import { loadConfig } from "./config.js";
import { runTests } from "./runner.js";

export const runCommand = defineCommand({
  meta: { name: "run", description: "Run prompt regression tests" },
  args: {
    config: {
      type: "string",
      description: "Path to wobble.yaml",
      default: "wobble.yaml",
      alias: "c",
    },
    test: {
      type: "string",
      description: "Run a single test by id",
      alias: "t",
    },
    tag: {
      type: "string",
      description: "Run tests matching a tag",
    },
    verbose: {
      type: "boolean",
      description: "Print model output for each run",
      alias: "v",
      default: false,
    },
  },
  async run({ args }) {
    let config;
    try {
      config = loadConfig(args.config);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    try {
      const result = await runTests({
        config,
        testFilter: args.test,
        tagFilter: args.tag,
        verbose: args.verbose,
      });
      process.exit(result.hasFailures ? 1 : 0);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  },
});
