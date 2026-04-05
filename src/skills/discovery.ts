/**
 * Skill discovery and loading integration
 */

import {
  DiscoveryManager,
  type SkillDescriptor,
} from "@browser-agent/cli-framework";
import { join } from "path";
import { homedir } from "node:os";
import type { Skill } from "../types.ts";

let discoveryManager: DiscoveryManager | null = null;

/**
 * Initialize skill discovery manager
 * Discovers skills from:
 * - Project directory: ./.ryft/skills/
 * - User directory: ~/.ryft/skills/
 */
export function initializeSkillDiscovery(): DiscoveryManager {
  if (discoveryManager) return discoveryManager;

  const projectSkillDirs = [
    join(process.cwd(), ".ryft", "skills"),
    join(process.cwd(), "skills"),
  ];

  const userSkillDir = join(homedir(), ".ryft", "skills");

  discoveryManager = new DiscoveryManager();

  // Add project skill directories
  discoveryManager.addSource(
    new (require("@browser-agent/cli-framework").FileDiscoverySource)(
      "project-skills",
      projectSkillDirs,
    ),
  );

  // Add user skill directory
  discoveryManager.addSource(
    new (require("@browser-agent/cli-framework").FileDiscoverySource)(
      "user-skills",
      userSkillDir,
    ),
  );

  return discoveryManager;
}

/**
 * Get the skill discovery manager
 */
export function getSkillDiscoveryManager(): DiscoveryManager {
  if (!discoveryManager) {
    return initializeSkillDiscovery();
  }
  return discoveryManager;
}

/**
 * Discover all available skills
 */
export async function discoverSkills(
  forceReload = false,
): Promise<SkillDescriptor[]> {
  const manager = getSkillDiscoveryManager();
  return manager.discoverSkills(forceReload);
}

/**
 * Convert discovered skill to Ryft Skill type
 */
export function skillDescriptorToSkill(descriptor: SkillDescriptor): Skill {
  return {
    name: descriptor.name,
    description: descriptor.description,
    file: descriptor.filePath,
  };
}

/**
 * Load skills and convert to Ryft format
 */
export async function loadRyftSkills(): Promise<Skill[]> {
  try {
    const descriptors = await discoverSkills();
    return descriptors.map(skillDescriptorToSkill);
  } catch (error) {
    console.warn("Failed to discover skills:", error);
    return [];
  }
}

/**
 * Clear skill discovery cache (e.g., when CWD changes)
 */
export function clearSkillCache(): void {
  if (discoveryManager) {
    discoveryManager.clearCache();
  }
}
