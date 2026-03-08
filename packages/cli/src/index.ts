#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { runCommand } from "./cli.js";
import { initCommand } from "./init.js";
import { baselineCommand } from "./baseline-cmd.js";
import { watchCommand } from "./watch.js";

const main = defineCommand({
  meta: {
    name: "wobble",
    version: "0.1.0",
    description: "Prompt regression testing for LLMs",
  },
  subCommands: {
    init: initCommand,
    run: runCommand,
    watch: watchCommand,
    baseline: baselineCommand,
  },
});

runMain(main);
