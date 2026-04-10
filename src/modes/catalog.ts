import type { Mode } from "../types.ts";
import { createMode } from "./types.ts";
import { loadModePackDefinitions, getModePacks } from "./pack-loader.ts";

const MODE_DEFS: Mode[] = [
  createMode({
    name: "coder",
    description: "Write and modify code with minimal overhead.",
    prompt:
      "You are a careful coder. Prefer small diffs, direct fixes, and concise explanations.",
    skillRoots: [".ryft/skills", "packs/shared/skills", "packs/coder/skills"],
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
      "You are a browser automation agent. To search the web, always navigate directly to the search URL (e.g. https://www.google.com/search?q=weather+ajmer) — never navigate to a homepage and type into a search box. To read page content, prefer browser_snapshot (fast, text-based) over browser_take_screenshot (slow, image). After a snapshot or screenshot, extract the answer and respond immediately — do not loop back to typing the same text. If you typed into a form field, submit with browser_press_key key=Enter. Available tools: browser_navigate, browser_snapshot, browser_take_screenshot, browser_click, browser_type, browser_press_key, browser_mouse_wheel, browser_fill_form, browser_take_screenshot, browser_file_upload, browser_select_option, browser_evaluate.",
    skillRoots: [
      ".ryft/skills",
      "packs/shared/skills",
      "packs/browser-surff/skills",
    ],
    mcpServers: [
      {
        name: "browser-session",
        description: "Browser session tab context and DevTools actions.",
      },
      {
        name: "playwright",
        description:
          "Rich browser automation: navigate, click, type, scroll, screenshot, upload files, fill forms, evaluate JS.",
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
    skillRoots: [
      ".ryft/skills",
      "packs/shared/skills",
      "packs/debugger/skills",
    ],
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
 * DEPRECATED: Use getModeSkills() from skill-merger.ts instead
 */
export function getMergedSkillsForModes(modes: Mode[], precedence?: string[]) {
  // Placeholder for future multi-mode skill merging
  // Currently, skills are merged on-demand via getModeSkills()
  return [];
}
