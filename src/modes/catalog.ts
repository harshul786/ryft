import type { Mode } from "../types.ts";
import { createMode } from "./types.ts";
import { loadModePackDefinitions, getModePacks } from "./pack-loader.ts";
import {
  mergeSkillsWithPrecedence,
  getEffectiveSkills,
} from "./skill-merger.ts";

const MODE_DEFS: Mode[] = [
  createMode({
    name: "coder",
    description: "Write and modify code with minimal overhead.",
    prompt:
      "You are a careful coder. Prefer small diffs, direct fixes, and concise explanations.",
    skillRoots: ["packs/shared/skills", "packs/coder/skills"],
    mcpServers: [
      { name: "filesystem", description: "Local filesystem MCP integrations." },
    ],
    memory: "claude-like",
  }),
  createMode({
    name: "browser-surff",
    description:
      "Use a browser session as the source of truth for UI inspection and action.",
    prompt:
      "You are a browser session agent. Read tab context first, prefer the current browser session, and use browser tools only when they help inspect or act on the user's page.",
    skillRoots: ["packs/shared/skills", "packs/browser-surff/skills"],
    mcpServers: [
      {
        name: "browser-session",
        description: "Browser session tab context and DevTools actions.",
      },
    ],
    memory: "hierarchy",
  }),
  createMode({
    name: "debugger",
    description:
      "Diagnose failures and produce actionable root-cause analysis.",
    prompt:
      "You are a debugger. Focus on evidence, logs, and reproduction steps.",
    skillRoots: ["packs/shared/skills", "packs/debugger/skills"],
    mcpServers: [
      { name: "logs", description: "Log and diagnostics integrations." },
    ],
    memory: "session",
  }),
];

export function listModes(): Mode[] {
  return MODE_DEFS.slice();
}

export function resolveModes(names: string[] = ["coder"]): Mode[] {
  const set = new Map(MODE_DEFS.map((mode) => [mode.name, mode]));
  const selected = names
    .flatMap((name) => String(name).split(","))
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => set.get(name))
    .filter((mode): mode is Mode => Boolean(mode));
  return selected.length ? selected : [set.get("coder") as Mode];
}

/**
 * List available mode packs from Ryft/packs directory
 * TODO #11: Load mode-pack definitions
 */
export function listAvailablePacks() {
  return loadModePackDefinitions(process.cwd());
}

/**
 * Get mode packs for a list of mode names
 */
export function getModePacksForModes(modeNames: string[]) {
  return getModePacks(modeNames, process.cwd());
}

/**
 * Get merged skills for multiple modes
 * TODO #13: Multi-mode skill merging
 */
export function getMergedSkillsForModes(modes: Mode[], precedence?: string[]) {
  const packs = getModePacksForModes(modes.map((m) => m.name));
  return getEffectiveSkills(packs, precedence || modes.map((m) => m.name));
}
