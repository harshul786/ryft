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
import { initializeSkillDiscovery } from "../../skills/discovery.ts";

// Register all commands
const allCommands: Command[] = [
  help,
  mode,
  model,
  config,
  memory,
  clear,
  skills,
  mcp,
  exit,
];

/**
 * Initialize command system by registering all handlers
 * Also initializes skill discovery for dynamic command loading
 */
export function initializeCommands(): void {
  allCommands.forEach(registerCommand);

  // Initialize skill discovery at startup to populate available skills
  try {
    const discoveryManager = initializeSkillDiscovery();
    if (process.env.DEBUG) {
      console.debug("[INIT] Skill discovery initialized");
    }
  } catch (error) {
    if (process.env.DEBUG) {
      console.debug(
        "[INIT] Warning: Failed to initialize skill discovery",
        error,
      );
    }
  }
}

// Auto-export for convenience
export { help, mode, model, config, memory, clear, skills, mcp, exit };
