/**
 * Skill Registry Module
 *
 * Central skill registration with deduplication by realpath.
 * Handles skill caching, discovery, and retrieval with conflict resolution.
 */

import { realpath } from "node:fs/promises";
import type { Skill } from "../types.ts";

/**
 * Tracks a skill and its source for deduplication
 */
interface RegistryEntry {
  skill: Skill;
  realPath: string;
  source: "bundled" | "user" | "project" | "mode";
  timestamp: number;
}

/**
 * Skill Registry - manages centralized skill registration and deduplication
 */
export class SkillRegistry {
  private entries: Map<string, RegistryEntry> = new Map();
  private realPathCache: Map<string, string> = new Map();
  private nameIndex: Map<string, string> = new Map(); // name -> realPath mapping
  private loadSignal: ((skills: Skill[]) => void) | null = null;

  /**
   * Register a skill in the registry with deduplication by realpath
   *
   * **Deduplication Strategy:**
   * - If skill has no file path: uses `source:name` as unique key
   * - If skill has file path: resolves to realpath (handles symlinks)
   * - Later registrations override earlier ones for same file
   * - Old name index entries are automatically cleaned up
   *
   * **Performance:**
   * - First registration: ~1-2ms (realpath resolution)
   * - Duplicate registration: <1ms (cached realpath)
   * - Name lookups: O(1) via index map
   *
   * **Example:**
   * ```typescript
   * const skill = { name: 'edit', file: 'skills/edit/SKILL.md' };
   * await registry.register(skill, 'mode');
   * ```
   *
   * @param skill - Skill object with name, file, and metadata
   * @param source - Source of skill (bundled/user/project/mode) for filtering
   */
  async register(skill: Skill, source: RegistryEntry["source"]): Promise<void> {
    if (!skill.file) {
      // For skills without file path, use name + source as unique key
      const key = `${source}:${skill.name}`;
      this.entries.set(key, {
        skill,
        realPath: key,
        source,
        timestamp: Date.now(),
      });
      this.nameIndex.set(skill.name, key);
      return;
    }

    // Resolve to realpath for deduplication
    const realPath = await this.resolveRealPath(skill.file);

    // If file already registered, remove old name index entry
    if (this.entries.has(realPath)) {
      const oldEntry = this.entries.get(realPath)!;
      // Remove old name from index if it's different
      if (oldEntry.skill.name !== skill.name) {
        this.nameIndex.delete(oldEntry.skill.name);
      }
    }

    // Check timestamp: only override if new registration is later
    const shouldRegister =
      !this.entries.has(realPath) ||
      Date.now() >= (this.entries.get(realPath)?.timestamp ?? 0);

    if (shouldRegister) {
      this.entries.set(realPath, {
        skill,
        realPath,
        source,
        timestamp: Date.now(),
      });
    }

    // Update name index with new skill name
    this.nameIndex.set(skill.name, realPath);
  }

  /**
   * Get a skill by name
   *
   * Uses internal name index for fast O(1) lookup.
   * Returns undefined if skill not found.
   *
   * @param name - Skill name to look up
   * @returns Skill object if found, undefined otherwise
   * @example
   * const skill = registry.get('edit');
   * if (skill) console.log(skill.description);
   */
  get(name: string): Skill | undefined {
    const realPath = this.nameIndex.get(name);
    if (!realPath) return undefined;
    return this.entries.get(realPath)?.skill;
  }

  /**
   * Get all registered skills sorted alphabetically by name
   *
   * **Performance:** O(n log n) where n = number of skills (due to sort)
   * Cache if calling repeatedly:
   * ```typescript
   * const cached = registry.getAll();
   * // Use cached instead of calling getAll() multiple times
   * ```
   *
   * @returns Array of all Skill objects sorted by name
   */
  getAll(): Skill[] {
    return Array.from(this.entries.values())
      .sort((a, b) => a.skill.name.localeCompare(b.skill.name))
      .map((entry) => entry.skill);
  }

  /**
   * Get skills from a specific source
   *
   * Filters registered skills by their origin (bundled, user, project, mode).
   * Useful for:
   * - Understanding skill composition per mode
   * - Debugging skill loading
   * - Filtering built-in vs user-defined skills
   *
   * @param source - Source to filter: 'bundled' | 'user' | 'project' | 'mode'
   * @returns Array of skills from this source, sorted by name
   * @example
   * const modeSkills = registry.getBySource('mode');
   * console.log(`Loaded ${modeSkills.length} mode-specific skills`);
   */
  getBySource(source: RegistryEntry["source"]): Skill[] {
    return Array.from(this.entries.values())
      .filter((entry) => entry.source === source)
      .sort((a, b) => a.skill.name.localeCompare(b.skill.name))
      .map((entry) => entry.skill);
  }

  /**
   * Clear all registered skills and caches
   *
   * Resets:
   * - All registered skills
   * - Name index
   * - Realpath cache
   *
   * Call this when:
   * - Skill files have been added/removed
   * - Need fresh discovery
   * - Testing (between test cases)
   */
  clear(): void {
    this.entries.clear();
    this.nameIndex.clear();
    this.realPathCache.clear();
  }

  /**
   * Get number of registered skills
   *
   * Useful for:
   * - Verifying discovery worked
   * - Monitoring skill load stats
   * - Assertions in tests
   *
   * @returns Number of unique skills in registry
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Register a callback to be called when skills are loaded
   *
   * Useful for:
   * - Cache invalidation
   * - UI updates when skills change
   * - Analytics/monitoring
   *
   * The callback receives the full skill array and can examine it.
   *
   * @param callback - Function called with array of skills when `emitLoad()` is called
   * @example
   * registry.onLoad((skills) => {
   *   console.log(`Skills updated: ${skills.length} total`);
   * });
   */
  onLoad(callback: (skills: Skill[]) => void): void {
    this.loadSignal = callback;
  }

  /**
   * Emit load signal to all registered callbacks
   *
   * Called internally by loader after discovery completes,
   * but can be called manually to notify about changes.
   *
   * @internal Usually called by loader.ts after discovery
   */
  emitLoad(): void {
    if (this.loadSignal) {
      this.loadSignal(this.getAll());
    }
  }

  /**
   * Resolve file path to realpath for deduplication
   *
   * **Why realpath?**
   * Handles symlinks and relative paths:
   * - Symlink `/link/to/skill` → `/actual/path/to/skill`
   * - Resolves `.`, `..` components
   * - Normalizes slashes (especially on Windows)
   *
   * **Caching:**
   * Results are cached to avoid repeated filesystem calls.
   * Cache persists until `clear()` called.
   *
   * **Error handling:**
   * If realpath fails (file doesn't exist), uses path as-is.
   * This allows registering skills before files are written (testing).
   *
   * @param filePath - Relative or absolute file path
   * @returns Promise resolving to full realpath (or original path if resolution fails)
   * @private
   */
  private async resolveRealPath(filePath: string): Promise<string> {
    if (this.realPathCache.has(filePath)) {
      return this.realPathCache.get(filePath)!;
    }

    try {
      const resolved = await realpath(filePath);
      this.realPathCache.set(filePath, resolved);
      return resolved;
    } catch {
      // If realpath fails (e.g., file doesn't exist), use path as-is
      this.realPathCache.set(filePath, filePath);
      return filePath;
    }
  }
}

/**
 * Global singleton registry instance
 */
let globalRegistry: SkillRegistry | null = null;

/**
 * Get or create the global skill registry singleton
 *
 * **Usage Pattern:**
 * ```typescript
 * const registry = getGlobalSkillRegistry();
 * const skill = registry.get('my-skill');
 * ```
 *
 * **Why a singleton?**
 * - Central, authoritative source of truth for all skills
 * - Prevents duplicate registrations across the app
 * - Easy to invalidate cache globally
 * - Consistent across async calls
 *
 * @returns Singleton SkillRegistry instance (creates on first call)
 */
export function getGlobalSkillRegistry(): SkillRegistry {
  if (!globalRegistry) {
    globalRegistry = new SkillRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global registry to factory state
 *
 * **When to call:**
 * - Between test cases (avoid test pollution)
 * - After major skill file changes
 * - For debugging
 *
 * **Important:** This is rarely needed in production.
 * Use `clearDiscoveryCache()` from loader.ts instead.
 *
 * @internal Primarily for testing
 */
export function resetGlobalRegistry(): void {
  if (globalRegistry) {
    globalRegistry.clear();
  }
  globalRegistry = null;
}
