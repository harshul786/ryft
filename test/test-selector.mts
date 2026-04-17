#!/usr/bin/env node
// Quick test of the model selector
import chalk from "chalk";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { interactiveModelSelectorWithSaved } from "../src/models/modelSelectorWithSaved.ts";
import { createSession } from "../src/runtime/session.ts";

const rl = readline.createInterface({ input, output });

const session = createSession({
  modes: [],
  memoryMode: "normal",
  model: {
    id: "gpt-4.1",
    label: "GPT-4.1",
    provider: "OpenAI",
    description: "test",
    baseUrl: "https://api.openai.com/v1",
  },
  cwd: process.cwd(),
  homeDir: process.env.HOME || "/root",
  proxyUrl: null,
  baseUrl: "https://api.openai.com/v1",
  apiKey: "test-key",
});

console.log(chalk.blue("Testing model selector...\n"));

const result = await interactiveModelSelectorWithSaved(session, rl);
console.log(chalk.green("\nResult:"), result);

rl.close();
process.exit(0);
