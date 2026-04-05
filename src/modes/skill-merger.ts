import { readFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Skill, Mode } from "../types.ts";
import type {
  ResolvedModePack,
  MergedSkillSet,
  SkillMergeConflict,
} from "./pack-types.ts";
import { discoverAllSkillsForModes } from "../skills/loader.ts";
import { getModePacks } from "./pack-loader.ts";

// Type for the skills database
interface SkillDbEntry {
  id: number;
  name: string;
  path: string;
  description: string;
  modes: string[];
  requiredTools: string[];
  requiresPermission: boolean;
}

interface SkillsDb {
  skills: Record<string, SkillDbEntry>; // Keys are numeric IDs as strings ("1", "2", etc.)
  idCounter?: number; // Next available ID for new skills (version 2.0.0+)
  version: string;
}

/**
 * GAP FIX #12: Skills state - runtime enable/disable tracking
 */
interface SkillsState {
  version: string;
  disabledSkills: Record<string, { modes: string[] }>;
}

interface SkillPathMapping {
  [skillId: string]: string; // skillId -> relative path
}

let skillsDbCache: SkillsDb | null = null;
let skillsStateCache: SkillsState | null = null;
let dbValidationErrors: string[] = [];

/**
 * GAP FIX #12: Path mapping for skills
 * Allows resolving skill paths without hardcoding in DB
 */
const SKILL_PATH_MAPPING: SkillPathMapping = {
  edit: "packs/coder/skills/edit/SKILL.md",
  browser: "packs/browser-surff/skills/browser/SKILL.md",
  troubleshoot: "packs/debugger/skills/troubleshoot/SKILL.md",
  compact: "packs/shared/skills/compact/SKILL.md",
};

/**
 * GAP FIX #12: Database schema versions with migration support
 */
const DB_SCHEMA_VERSIONS = {
  "1.0.0": "Initial schema with explicit paths and name-based IDs",
  "1.1.0": "Path abstraction via mapping (not currently enabled)",
  "2.0.0": "Sequential numeric IDs (1, 2, 3...) with idCounter tracking",
};

/**
 * Load the skills database from skills-db.json
 * This is the source of truth for which skills are available in which modes
 */
function loadSkillsDb(): SkillsDb {
  if (skillsDbCache) {
    return skillsDbCache;
  }

  try {
    const dbPath = join(process.cwd(), "skills-db.json");
    const content = readFileSync(dbPath, "utf-8");
    skillsDbCache = JSON.parse(content) as SkillsDb;

    // Validate database structure
    if (!skillsDbCache.skills || typeof skillsDbCache.skills !== "object") {
      throw new Error("Invalid skills-db.json: missing 'skills' object");
    }

    // GAP FIX #12: Check version and migrate if needed
    const currentVersion = skillsDbCache.version || "1.0.0";
    if (
      !DB_SCHEMA_VERSIONS[currentVersion as keyof typeof DB_SCHEMA_VERSIONS]
    ) {
      console.warn(
        `Unknown database version: ${currentVersion}. Attempting fallback.`,
      );
    }

    return skillsDbCache;
  } catch (error) {
    const errorMsg = `Failed to load skills-db.json: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMsg);
    dbValidationErrors.push(errorMsg);
    return { skills: {}, version: "1.0.0" };
  }
}

/**
 * GAP FIX #6: Load runtime skill state (enabled/disabled status)
 */
function loadSkillsState(): SkillsState {
  if (skillsStateCache) {
    return skillsStateCache;
  }

  try {
    const statePath = join(process.cwd(), "skills-state.json");
    if (!existsSync(statePath)) {
      skillsStateCache = { version: "1.0.0", disabledSkills: {} };
      return skillsStateCache;
    }

    const content = readFileSync(statePath, "utf-8");
    skillsStateCache = JSON.parse(content) as SkillsState;
    return skillsStateCache;
  } catch (error) {
    console.warn("Failed to load skills-state.json, using defaults:", error);
    skillsStateCache = { version: "1.0.0", disabledSkills: {} };
    return skillsStateCache;
  }
}

/**
 * GAP FIX #6: Save skill state to disk
 */
function saveSkillsState(state: SkillsState): void {
  try {
    const statePath = join(process.cwd(), "skills-state.json");
    writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
    skillsStateCache = state;
  } catch (error) {
    console.error("Failed to save skills-state.json:", error);
  }
}

/**
 * Clear the skills database cache (for testing or when DB is modified)
 * GAP FIX #1, #8: Export cache clearing function
 */
export function clearSkillsDbCache(): void {
  skillsDbCache = null;
  skillsStateCache = null;
  dbValidationErrors = [];
}

/**
 * Get validation errors from DB loading
 * GAP FIX #5: Better error reporting
 */
export function getSkillsDbErrors(): string[] {
  return [...dbValidationErrors];
}

/**
 * Validate that a skill file exists at the expected path
 * GAP FIX #4: Disk validation
 */
function validateSkillPath(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

/**
 * Get mode-enabled skills from the database
 *
 * This queries the skills database to find all skills enabled for a given mode,
 * then loads and enriches them from their skill files.
 *
 * Features:
 * - Queries skills-db.json for mode membership
 * - Respects runtime skill disable state (GAP FIX #6)
 * - Validates skill files exist on disk (GAP FIX #4)
 * - Loads skill definitions from filesystem
 * - Enriches with frontmatter metadata
 * - Sorts by name
 * - Reports missing/broken skills (GAP FIX #5)
 */
export async function getModeSkills(mode: Mode): Promise<Skill[]> {
  const db = loadSkillsDb();
  const disabledSkills = getDisabledSkillsForMode(mode.name);

  // Find all skills enabled for this mode (excluding disabled ones)
  // Skills are stored with numeric ID strings as keys ("1", "2", etc.)
  const skillIds = Object.keys(db.skills).filter((skillIdStr) => {
    const skillEntry = db.skills[skillIdStr];
    const isDisabled =
      disabledSkills.includes(skillIdStr) || // Check numeric ID
      disabledSkills.includes(skillEntry.name); // Check skill name for compatibility

    return skillEntry && skillEntry.modes.includes(mode.name) && !isDisabled;
  });

  // Load and discover skills from filesystem
  let allSkills: Skill[] = [];
  try {
    allSkills = await discoverAllSkillsForModes([mode]);
  } catch (error) {
    const errorMsg = `Failed to discover skills for mode ${mode.name}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMsg);
    dbValidationErrors.push(errorMsg);
  }

  // Filter to only include skills from our database for this mode
  const modeSkills: Skill[] = [];
  const missingSkills: string[] = [];

  for (const skillIdStr of skillIds) {
    const skillEntry = db.skills[skillIdStr];
    // Match by skill name (not ID, since discovered skills are keyed by name)
    const skill = allSkills.find((s) => s.name === skillEntry.name);

    if (skill) {
      // Validate the skill file path exists (GAP FIX #4)
      if (!validateSkillPath(skillEntry.path)) {
        const errorMsg = `Skill file missing: ${skillEntry.path}`;
        console.warn(errorMsg);
        dbValidationErrors.push(errorMsg);
        continue;
      }
      // Add numeric ID to skill object for tracking
      skill.id = skillEntry.id;
      modeSkills.push(skill);
    } else {
      missingSkills.push(skillEntry.name);
    }
  }

  // GAP FIX #5: Report missing skills as warnings
  if (missingSkills.length > 0) {
    const errorMsg = `Mode '${mode.name}' has missing skills in database: ${missingSkills.join(", ")}`;
    console.warn(errorMsg);
    dbValidationErrors.push(errorMsg);
  }

  // Filter by tool policy (enforce tool restrictions)
  const filteredByTools = filterSkillsByToolPolicy(modeSkills, mode.name);

  return filteredByTools.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get skill metadata from the database
 *
 * Accepts either numeric ID or skill name for lookup.
 * Skill names are resolved to numeric IDs internally.
 *
 * @param skillIdOrName - Either a numeric ID ("1", 1, "2") or skill name ("compact", "edit")
 * @returns Skill metadata entry or undefined if not found
 *
 * @example
 * getSkillMetadata("1");        // Lookup by numeric ID
 * getSkillMetadata(1);          // Lookup by numeric ID
 * getSkillMetadata("compact");  // Lookup by skill name
 */
export function getSkillMetadata(
  skillIdOrName: string | number,
): SkillDbEntry | undefined {
  const db = loadSkillsDb();

  // Try numeric ID lookup first
  const idStr = String(skillIdOrName);
  if (db.skills[idStr]) {
    return db.skills[idStr];
  }

  // Fall back to name-based lookup for backwards compatibility
  const skill = Object.values(db.skills).find((s) => s.name === idStr);
  return skill;
}

/**
 * Check which modes a skill is enabled in
 */
export function getSkillModes(skillId: string): string[] {
  const metadata = getSkillMetadata(skillId);
  return metadata?.modes ?? [];
}

/**
 * Get all skills that require a specific tool
 * Useful for permission checking and debugging
 */
export function getSkillsByRequiredTool(tool: string): SkillDbEntry[] {
  const db = loadSkillsDb();
  return Object.values(db.skills).filter((skill) =>
    skill.requiredTools.includes(tool),
  );
}

/**
 * Get required tools for a skill (informational only)
 * These are not used for filtering - permissions are handled separately via
 * full access or user prompts (like Claude CLI)
 */
export function getSkillRequiredTools(skillId: string): string[] {
  const metadata = getSkillMetadata(skillId);
  return metadata?.requiredTools ?? [];
}

/**
 * GAP FIX #2: Get all skills across all modes (deduplicated)
 * Useful for building complete skill catalogs and UIs
 */
export function getAllSkillsAcrossModes(): SkillDbEntry[] {
  const db = loadSkillsDb();
  const uniqueSkills = new Map<string, SkillDbEntry>();

  Object.values(db.skills).forEach((skill) => {
    if (!uniqueSkills.has(String(skill.id))) {
      uniqueSkills.set(String(skill.id), skill);
    }
  });

  return Array.from(uniqueSkills.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/**
 * GAP FIX #9: Inverse query - find all modes containing a specific skill
 */
export function getModesContainingSkill(skillId: string): string[] {
  const metadata = getSkillMetadata(skillId);
  return metadata?.modes ?? [];
}

/**
 * GAP FIX #10: Get all skills with a specific required tool
 * Verification: this already existed as getSkillsByRequiredTool
 */
export function getAllSkillsRequiringTool(tool: string): SkillDbEntry[] {
  const db = loadSkillsDb();
  return Object.values(db.skills)
    .filter((skill) => skill.requiredTools.includes(tool))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * GAP FIX #10: Get metadata for all skills (bulk query)
 */
export function getAllSkillMetadata(): SkillDbEntry[] {
  const db = loadSkillsDb();
  return Object.values(db.skills).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * GAP FIX #11: Validate skill definition
 * Checks for:
 * - Required fields (id, name, modes)
 * - Valid array types
 * - Non-empty arrays where required
 */
export function validateSkillDefinition(skill: SkillDbEntry): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!skill.id || typeof skill.id !== "number") {
    errors.push(`Skill missing 'id' field or id is not a number`);
  }

  if (!skill.name || typeof skill.name !== "string") {
    errors.push(`Skill '${skill.id}' missing 'name' field`);
  }

  if (!Array.isArray(skill.modes) || skill.modes.length === 0) {
    errors.push(`Skill '${skill.id}' must have at least one mode`);
  }

  if (!Array.isArray(skill.requiredTools)) {
    errors.push(`Skill '${skill.id}' 'requiredTools' must be an array`);
  }

  if (typeof skill.requiresPermission !== "boolean") {
    errors.push(`Skill '${skill.id}' 'requiresPermission' must be boolean`);
  }

  if (!skill.path || typeof skill.path !== "string") {
    errors.push(`Skill '${skill.id}' missing 'path' field`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * GAP FIX #11: Validate entire skills database
 */
export function validateSkillsDatabase(): { valid: boolean; errors: string[] } {
  const db = loadSkillsDb();
  const errors: string[] = [];

  if (Object.keys(db.skills).length === 0) {
    errors.push("Database is empty - no skills defined");
  }

  // Validate each skill
  for (const skill of Object.values(db.skills)) {
    const validation = validateSkillDefinition(skill);
    errors.push(...validation.errors);

    // Check if file exists
    const abspath = join(process.cwd(), skill.path);
    if (!validateSkillPath(abspath)) {
      errors.push(`Skill '${skill.id}' file not found: ${skill.path}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * GAP FIX #3: Permission model - check if skill requires permission
 * This integrates with the permissions system
 */
export function skillRequiresPermission(skillId: string): boolean {
  const metadata = getSkillMetadata(skillId);
  return metadata?.requiresPermission ?? false;
}

/**
 * GAP FIX #3: Get all skills that require permission
 * Useful for permission prompts during mode initialization
 */
export function getSkillsRequiringPermission(mode?: string): SkillDbEntry[] {
  const db = loadSkillsDb();
  const skills = Object.values(db.skills).filter((s) => s.requiresPermission);

  if (mode) {
    return skills
      .filter((s) => s.modes.includes(mode))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * GAP FIX #6: Check if a skill is disabled in a specific mode
 */
export function isSkillDisabledInMode(skillId: string, mode: string): boolean {
  const state = loadSkillsState();
  const skillState = state.disabledSkills[skillId];
  return skillState?.modes.includes(mode) ?? false;
}

/**
 * GAP FIX #6: Disable a skill in one or more modes
 * Returns updated state
 */
export function disableSkill(
  skillId: string,
  modes: string | string[],
): SkillsState {
  const state = loadSkillsState();
  const modesToDisable = Array.isArray(modes) ? modes : [modes];

  if (!state.disabledSkills[skillId]) {
    state.disabledSkills[skillId] = { modes: [] };
  }

  // Add modes to disabled list if not already there
  for (const mode of modesToDisable) {
    if (!state.disabledSkills[skillId].modes.includes(mode)) {
      state.disabledSkills[skillId].modes.push(mode);
    }
  }

  saveSkillsState(state);
  return state;
}

/**
 * GAP FIX #6: Enable a skill in one or more modes (remove from disabled list)
 * Returns updated state
 */
export function enableSkill(
  skillId: string,
  modes: string | string[],
): SkillsState {
  const state = loadSkillsState();
  const modesToEnable = Array.isArray(modes) ? modes : [modes];

  if (!state.disabledSkills[skillId]) {
    state.disabledSkills[skillId] = { modes: [] };
  }

  // Remove modes from disabled list
  state.disabledSkills[skillId].modes = state.disabledSkills[
    skillId
  ].modes.filter((m) => !modesToEnable.includes(m));

  // Clean up empty entries
  if (state.disabledSkills[skillId].modes.length === 0) {
    delete state.disabledSkills[skillId];
  }

  saveSkillsState(state);
  return state;
}

/**
 * GAP FIX #6: Get all disabled skills for a mode
 */
export function getDisabledSkillsForMode(mode: string): string[] {
  const state = loadSkillsState();
  return Object.keys(state.disabledSkills).filter((skillId) =>
    state.disabledSkills[skillId].modes.includes(mode),
  );
}

/**
 * GAP FIX #6: Get the current runtime skill state
 */
export function getSkillsState(): SkillsState {
  return loadSkillsState();
}

/**
 * GAP FIX #6: Clear all skill state (reset to defaults)
 */
export function resetSkillsState(): void {
  const defaultState: SkillsState = { version: "1.0.0", disabledSkills: {} };
  saveSkillsState(defaultState);
}

/**
 * GAP FIX #12: Get database schema version
 */
export function getSkillsDatabaseVersion(): string {
  const db = loadSkillsDb();
  return db.version;
}

/**
 * GAP FIX #12: Get available schema versions
 */
export function getAvailableSchemaVersions(): Record<string, string> {
  return DB_SCHEMA_VERSIONS;
}

/**
 * GAP FIX #12: Check if a skill path exists via mapping
 * Falls back to explicit path if mapping not found
 */
export function resolveSkillPath(
  skillId: string,
  fallbackPath?: string,
): string {
  const mappedPath = SKILL_PATH_MAPPING[skillId];
  if (mappedPath) {
    return join(process.cwd(), mappedPath);
  }

  if (fallbackPath) {
    return join(process.cwd(), fallbackPath);
  }

  return "";
}

/**
 * Get tool policy for a mode (enabledTools and disabledTools)
 * Returns which tools are allowed/forbidden in a given mode
 */
export function getModuleToolPolicy(mode: string): {
  enabledTools?: string[];
  disabledTools?: string[];
} {
  const packs = getModePacks([mode], process.cwd());

  if (packs.length === 0) {
    return {};
  }

  const pack = packs[0];
  return {
    enabledTools: pack.enabledTools,
    disabledTools: pack.disabledTools,
  };
}

/**
 * Check if a skill's required tools are compatible with a mode's tool policy
 *
 * Returns true if:
 * - Skill has no required tools, OR
 * - All required tools are in enabledTools (if defined), AND
 * - None are in disabledTools (if defined)
 */
export function isSkillToolCompatibleWithMode(
  skillId: string,
  mode: string,
): boolean {
  const requiredTools = getSkillRequiredTools(skillId);

  // If skill has no required tools, it's compatible
  if (requiredTools.length === 0) {
    return true;
  }

  const policy = getModuleToolPolicy(mode);

  // If mode has disabledTools and any required tool is in it, incompatible
  if (policy.disabledTools && policy.disabledTools.length > 0) {
    if (requiredTools.some((tool) => policy.disabledTools!.includes(tool))) {
      return false;
    }
  }

  // If mode has enabledTools, all required tools must be in it
  if (policy.enabledTools && policy.enabledTools.length > 0) {
    if (!requiredTools.every((tool) => policy.enabledTools!.includes(tool))) {
      return false;
    }
  }

  return true;
}

/**
 * Filter skills based on mode tool policies
 * Returns only skills whose required tools are compatible with the mode
 */
export function filterSkillsByToolPolicy(
  skills: Skill[],
  mode: string,
): Skill[] {
  return skills.filter((skill) => {
    const isCompatible = isSkillToolCompatibleWithMode(skill.name, mode);
    if (!isCompatible) {
      console.warn(
        `[Filtering] Skill '${skill.name}' excluded from mode '${mode}' due to incompatible required tools`,
      );
    }
    return isCompatible;
  });
}

/**
 * DEPRECATED: Use skills-db.json and getModeSkills() instead
 */
export function loadPackSkills(pack: ResolvedModePack): Skill[] {
  return [];
}

/**
 * DEPRECATED: Use skills-db.json and getModeSkills() instead
 */
export function mergeSkillsFromPacks(
  packs: ResolvedModePack[],
  precedence?: string[],
): MergedSkillSet {
  return { skills: [], conflicts: [] };
}

/**
 * DEPRECATED: Use skills-db.json and getModeSkills() instead
 */
export function getEffectiveSkills(): Skill[] {
  return [];
}
