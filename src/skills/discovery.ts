/**
 * DEPRECATED: This module should not be used.
 *
 * Skill discovery is now handled by:
 * - src/skills/loader.ts: Filesystem discovery via Mode.skillRoots
 * - src/modes/skill-merger.ts: Database-driven filtering and state management
 * - src/skills/registry.ts: Deduplication and caching
 *
 * All Modes now include ".ryft/skills" in their skillRoots, enabling
 * project-specific skills to be discovered automatically.
 *
 * If you need skills for a mode, use:
 *   import { getModeSkills } from "../modes/skill-merger.ts";
 *   const skills = await getModeSkills(mode);
 */

import type { Skill } from "../types.ts";

/**
 * @deprecated Use getModeSkills() from skill-merger.ts instead
 */
export async function loadRyftSkills(): Promise<Skill[]> {
  console.warn(
    "[DEPRECATED] loadRyftSkills() is no longer supported. Use getModeSkills() from skill-merger.ts instead.",
  );
  return [];
}

/**
 * @deprecated Use getModeSkills() from skill-merger.ts instead
 */
export function initializeSkillDiscovery() {
  console.warn(
    "[DEPRECATED] initializeSkillDiscovery() is no longer needed. Skills are discovered automatically from Mode.skillRoots.",
  );
  return null;
}

/**
 * @deprecated Use clearDiscoveryCache() from loader.ts instead
 */
export function clearSkillCache(): void {
  console.warn(
    "[DEPRECATED] clearSkillCache() is no longer supported. Use clearDiscoveryCache() from loader.ts instead.",
  );
}
