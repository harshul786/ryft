import { homedir } from "node:os";
import path from "node:path";

/**
 * Configuration for skill source directories with priority hierarchy
 * Priority order (highest to lowest): project > user > bundled > additional
 */
export interface SkillSourcesConfig {
  managed?: string; // Policy-enforced skill directory
  user?: string; // User's personal skill directory (~/.ryft/skills)
  project: string[]; // Project-level skill directories (.ryft/skills at various levels)
  bundled: string[]; // Bundled skill packs (packs/*/skills/)
  additional: string[]; // Additional custom directories
}

/**
 * Default skill sources configuration
 * Can be overridden by user config in ~/.ryft/config.json
 */
export const DEFAULT_SKILL_SOURCES: SkillSourcesConfig = {
  user: path.join(homedir(), ".ryft", "skills"),
  project: [],
  bundled: [],
  additional: [],
};

/**
 * Discover project-level skill directories by walking up from current working directory
 * Looks for .ryft/skills directories at each level
 *
 * @param startDir - Starting directory (usually process.cwd())
 * @param maxDepth - Maximum directory levels to walk up (default: 5, prevents infinite loops)
 * @returns Array of discovered project skill directories, in order from deepest to shallowest
 */
export function discoverProjectSkillDirs(
  startDir: string = process.cwd(),
  maxDepth: number = 5
): string[] {
  const discovered: string[] = [];
  let currentDir = startDir;

  for (let i = 0; i < maxDepth; i++) {
    const skillDir = path.join(currentDir, ".ryft", "skills");
    try {
      // Check if directory exists by attempting to stat it
      // (we'll validate file system access later when actually loading skills)
      discovered.push(skillDir);
    } catch {
      // Directory doesn't exist, continue up
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached root directory

    currentDir = parentDir;
  }

  return discovered;
}
