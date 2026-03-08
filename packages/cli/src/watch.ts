import { defineCommand } from "citty";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { loadConfig } from "./config.js";
import { runTests } from "./runner.js";
import { loadBaseline, compareBaseline } from "./baseline.js";
import { printBaselineComparison } from "./output/terminal.js";

export const watchCommand = defineCommand({
  meta: { name: "watch", description: "Re-run tests on config or prompt file changes" },
  args: {
    config: {
      type: "string",
      description: "Path to wobble.yaml",
      default: "wobble.yaml",
      alias: "c",
    },
    test: {
      type: "string",
      description: "Watch a single test by id",
      alias: "t",
    },
    tag: {
      type: "string",
      description: "Watch tests matching a tag",
    },
    verbose: {
      type: "boolean",
      description: "Print model output for each run",
      alias: "v",
      default: false,
    },
    baseline: {
      type: "string",
      description: "Path to baseline file for regression comparison",
      default: ".wobble/baseline.json",
    },
  },
  async run({ args }) {
    const configPath = path.resolve(args.config);

    // debounce: coalesce rapid saves (e.g. editor write + chmod) into one run
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let running = false;

    const watchers: fs.FSWatcher[] = [];

    function stopWatchers() {
      for (const w of watchers) w.close();
      watchers.length = 0;
    }

    async function runOnce() {
      if (running) return;
      running = true;

      console.clear();
      console.log(chalk.dim(`[${new Date().toLocaleTimeString()}] Running…\n`));

      let config;
      try {
        config = loadConfig(configPath);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        running = false;
        return;
      }

      // Re-register watchers every run so new prompt_files are picked up
      stopWatchers();
      const watchPaths = new Set<string>([configPath]);
      for (const test of config.tests) {
        if (test.prompt_file) watchPaths.add(test.prompt_file);
      }

      for (const p of watchPaths) {
        if (!fs.existsSync(p)) continue;
        try {
          const w = fs.watch(p, () => scheduleRun());
          watchers.push(w);
        } catch {
          // non-fatal if a file can't be watched
        }
      }

      try {
        const result = await runTests({
          config,
          testFilter: args.test,
          tagFilter: args.tag,
          verbose: args.verbose,
        });

        const baseline = loadBaseline(args.baseline);
        if (baseline) {
          const regressionThreshold = config.limits?.regression_threshold ?? 0.05;
          const comparison = compareBaseline(baseline, result.results, regressionThreshold);
          printBaselineComparison(comparison);
        }
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      }

      console.log(chalk.dim(`\nWatching for changes… (Ctrl+C to quit)`));
      running = false;
    }

    function scheduleRun() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        runOnce();
      }, 300);
    }

    // Watch the config file even before first load succeeds
    if (fs.existsSync(configPath)) {
      const w = fs.watch(configPath, () => scheduleRun());
      watchers.push(w);
    } else {
      console.error(chalk.red(`Config file not found: ${configPath}`));
      process.exit(1);
    }

    // Handle Ctrl+C cleanly
    process.on("SIGINT", () => {
      stopWatchers();
      console.log(chalk.dim("\nStopped."));
      process.exit(0);
    });

    // Initial run
    await runOnce();
  },
});
