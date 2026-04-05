import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Mode, Skill } from '../types.ts';
import { getGlobalSkillRegistry } from './registry.ts';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));

// Memoization cache: modes key -> skills array
const discoveryCache = new Map<string, Skill[]>();

/**
 * Parse skill metadata from file content
 */
function parseSkillMetadata(text: string, fallbackName: string): Skill {
  const nameMatch = text.match(/^name:\s*(.+)$/m);
  const descriptionMatch = text.match(/^description:\s*(.+)$/m);
  return {
    name: nameMatch?.[1]?.trim() || fallbackName,
    description: descriptionMatch?.[1]?.trim() || text.split('\n').slice(0, 3).join(' ').trim(),
  };
}

/**
 * Generate cache key from modes
 */
function generateCacheKey(modes: Mode[]): string {
  return modes
    .map(m => m.name)
    .sort()
    .join(',');
}

/**
 * Scan a directory for skill files and load them
 */
async function loadSkillDir(dirPath: string): Promise<Skill[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const skillFile = path.join(entryPath, 'SKILL.md');
        try {
          await stat(skillFile);
          files.push(skillFile);
        } catch {
          continue;
        }
      } else if (entry.isFile() && entry.name.toLowerCase() === 'skill.md') {
        files.push(entryPath);
      }
    }
  } catch {
    return [];
  }

  const skills: Skill[] = [];
  for (const file of files) {
    try {
      const text = await readFile(file, 'utf8');
      const parsed = parseSkillMetadata(text, path.basename(path.dirname(file)));
      skills.push({
        name: parsed.name,
        description: parsed.description || text.split('\n').slice(0, 3).join(' ').trim(),
        file,
      });
    } catch (error) {
      console.warn(`Failed to load skill from ${file}:`, error);
    }
  }
  return skills;
}

/**
 * Load skills from multiple directories in parallel
 */
async function loadSkillsFromDirs(dirPaths: string[]): Promise<Skill[]> {
  const results = await Promise.all(
    dirPaths.map(dirPath => loadSkillDir(dirPath))
  );
  return results.flat();
}

/**
 * Discover all skills for given modes with deduplication and caching
 * 
 * Features:
 * - Parallel loading from all skill roots
 * - Deduplication by realpath
 * - Memoization by mode set
 * - Alphabetical sorting
 */
export async function discoverAllSkillsForModes(modes: Mode[]): Promise<Skill[]> {
  // Check cache first
  const cacheKey = generateCacheKey(modes);
  if (discoveryCache.has(cacheKey)) {
    return discoveryCache.get(cacheKey)!;
  }

  // Collect all skill roots from modes
  const skillRoots = [...new Set(modes.flatMap(mode => mode.skillRoots ?? []))];
  
  // Convert to absolute paths
  const absolutePaths = skillRoots.map(root => path.join(projectRoot, root));

  // Load skills in parallel
  const loadedSkills = await loadSkillsFromDirs(absolutePaths);

  // Get registry and register all skills
  const registry = getGlobalSkillRegistry();
  
  for (const skill of loadedSkills) {
    await registry.register(skill, 'mode');
  }

  // Get deduplicated skills from registry
  const dedupedSkills = registry.getAll();

  // Cache result
  discoveryCache.set(cacheKey, dedupedSkills);

  // Emit load signal
  registry.emitLoad();

  return dedupedSkills;
}

/**
 * Clear discovery cache (e.g., when modes change or files are written)
 */
export function clearDiscoveryCache(): void {
  discoveryCache.clear();
  getGlobalSkillRegistry().clear();
}

/**
 * Legacy wrapper for backwards compatibility
 * @deprecated Use discoverAllSkillsForModes() instead
 */
export async function loadSkillsForModes(modes: Mode[]): Promise<Skill[]> {
  return discoverAllSkillsForModes(modes);
}
