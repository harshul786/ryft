import type { Skill, McpServer } from "../types.ts";

/**
 * Definition of a mode pack
 * Pack files are located at: Ryft/packs/{mode-name}/pack.json
 */
export interface ModePackDefinition {
  name: string; // unique pack name (e.g., "coder", "browser-surff")
  description: string;

  // Skills available in this pack
  skills?: Skill[];
  skillDirectory?: string; // path to skills directory (default: packs/{name}/skills)

  // MCP servers exposed by this pack
  mcpServers?: Array<
    McpServer & { id?: string; command?: string; args?: string[] }
  >;

  // Prompt fragment for this mode
  prompt?: string;

  // Memory mode preference for this pack
  memory?: "normal" | "hierarchy" | "session";

  // Tool policy: which tools are enabled/disabled in this mode
  enabledTools?: string[];
  disabledTools?: string[];

  // Metadata
  version?: string;
  author?: string;
}

/**
 * Resolved mode pack with paths and loaded content
 */
export interface ResolvedModePack extends ModePackDefinition {
  _packPath: string; // absolute path to pack directory
  _definitionPath: string; // absolute path to pack.json
}

export interface SkillMergeConflict {
  skillName: string;
  sources: string[]; // pack names that define this skill
  resolution: string; // which pack won
}

export interface MergedSkillSet {
  skills: Skill[];
  conflicts: SkillMergeConflict[];
}
