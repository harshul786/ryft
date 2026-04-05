import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Skill } from "../types.ts";
import type {
  ResolvedModePack,
  MergedSkillSet,
  SkillMergeConflict,
} from "./pack-types.ts";

/**
 * TODO #12: Extend skill loading to be mode-pack aware
 * Load skills from mode pack directories instead of global directory
 */
export function loadPackSkills(pack: ResolvedModePack): Skill[] {
  if (pack.skills && pack.skills.length > 0) {
    // Skills already defined in pack.json
    return pack.skills;
  }

  // Try to load skills from directory
  const skillDir = pack.skillDirectory || join(pack._packPath, "skills");
  return loadSkillsFromDirectory(skillDir, pack.name);
}

/**
 * Load all skills from a directory
 */
function loadSkillsFromDirectory(dirPath: string, packName: string): Skill[] {
  const skills: Skill[] = [];

  if (!existsSync(dirPath)) {
    return skills;
  }

  try {
    const files = readdirSync(dirPath);

    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      const filePath = join(dirPath, file);
      try {
        const skill = parseSkillFile(filePath, packName);
        if (skill) {
          skills.push(skill);
        }
      } catch (error) {
        console.warn(`Warning: Failed to parse skill file ${filePath}:`, error);
      }
    }
  } catch (error) {
    console.warn(`Warning: Failed to read skill directory ${dirPath}:`, error);
  }

  return skills;
}

/**
 * Parse a standalone skill .md file
 * Expected format:
 * # Skill Name
 * Description of skill...
 */
function parseSkillFile(filePath: string, packName: string): Skill | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    // First line should be # Title
    const titleLine = lines.find((line) => line.startsWith("# "));
    if (!titleLine) {
      return null;
    }

    const name = titleLine.replace(/^#\s*/, "").trim();

    // Everything after title is description until next heading
    const descStart = lines.indexOf(titleLine) + 1;
    const descEnd = lines.findIndex(
      (line, idx) => idx > descStart && line.startsWith("#"),
    );
    const descLines = lines.slice(
      descStart,
      descEnd === -1 ? undefined : descEnd,
    );
    const description = descLines
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n");

    return {
      name,
      description: description || `Skill from ${packName}`,
      file: filePath,
    };
  } catch (error) {
    console.warn(`Failed to parse skill from ${filePath}:`, error);
    return null;
  }
}

/**
 * TODO #13: Implement multi-mode skill merging
 * Merge skills from multiple modes with conflict resolution
 */
export function mergeSkillsFromPacks(
  packs: ResolvedModePack[],
  precedence: string[] = packs.map((p) => p.name),
): MergedSkillSet {
  const skills: Skill[] = [];
  const skillsByName = new Map<string, Skill & { source: string }>();
  const conflicts: SkillMergeConflict[] = [];

  // Load skills from each pack in order (earlier packs win on conflict)
  for (const pack of packs) {
    const packSkills = loadPackSkills(pack);

    for (const skill of packSkills) {
      if (skillsByName.has(skill.name)) {
        // Conflict: skill already exists from earlier pack
        const existing = skillsByName.get(skill.name)!;
        const conflict: SkillMergeConflict = {
          skillName: skill.name,
          sources: [existing.source, pack.name],
          resolution: existing.source, // earlier pack wins
        };

        // Check if we already tracked this conflict
        if (!conflicts.some((c) => c.skillName === skill.name)) {
          conflicts.push(conflict);
        }
      } else {
        // New skill: add it
        const withSource = { ...skill, source: pack.name };
        skillsByName.set(skill.name, withSource);
        skills.push(skill);
      }
    }
  }

  return { skills, conflicts };
}

/**
 * Merge skills with custom precedence order
 * Precedence is a list of pack names in order of priority (first wins)
 */
export function mergeSkillsWithPrecedence(
  packs: ResolvedModePack[],
  precedence: string[],
): MergedSkillSet {
  // Sort packs by precedence
  const sortedPacks = precedence
    .map((name) => packs.find((p) => p.name === name))
    .filter((p): p is ResolvedModePack => !!p)
    .concat(packs.filter((p) => !precedence.includes(p.name)));

  return mergeSkillsFromPacks(sortedPacks, precedence);
}

/**
 * Filter skills by tool policy
 */
export function filterSkillsByPolicy(
  skills: Skill[],
  enabledTools?: string[],
  disabledTools?: string[],
): Skill[] {
  return skills.filter((skill) => {
    // If disabled list provided and skill is in it, filter out
    if (disabledTools?.includes(skill.name)) {
      return false;
    }

    // If enabled list provided and skill is not in it, filter out
    if (enabledTools && !enabledTools.includes(skill.name)) {
      return false;
    }

    return true;
  });
}

/**
 * Get effective skills for a set of modes with merging and filtering
 */
export function getEffectiveSkills(
  packs: ResolvedModePack[],
  precedence?: string[],
): Skill[] {
  // Merge skills
  const merged = mergeSkillsWithPrecedence(
    packs,
    precedence || packs.map((p) => p.name),
  );

  // Apply tool policies from all packs
  let filtered = merged.skills;
  for (const pack of packs) {
    filtered = filterSkillsByPolicy(
      filtered,
      pack.enabledTools,
      pack.disabledTools,
    );
  }

  return filtered;
}
