import type { Command } from "../../commands.ts";
import { registerCommand } from "../../commands.ts";
import { help } from "./help.ts";
import { mode } from "./mode.ts";
import { model } from "./model.ts";
import { exit } from "./exit.ts";
import { config } from "./config.ts";
import { memory } from "./memory.ts";
import { clear } from "./clear.ts";
import { skills } from "./skills.ts";
import { mcp } from "./mcp.ts";
import { createSkill } from "./createSkill.ts";

// Register all commands
const allCommands: Command[] = [
  help,
  mode,
  model,
  config,
  memory,
  clear,
  skills,
  createSkill,
  mcp,
  exit,
];

/**
 * Initialize command system by registering all handlers
 */
export function initializeCommands(): void {
  allCommands.forEach(registerCommand);

  if (process.env.DEBUG) {
    console.debug("[INIT] Commands initialized");
  }
}

// Auto-export for convenience
export { help, mode, model, config, memory, clear, skills, createSkill, mcp, exit };
