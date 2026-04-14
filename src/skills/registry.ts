/**
 * Skill Registry Module
 *
 * Central skill registration with deduplication by realpath.
 * Handles skill caching, discovery, and retrieval with conflict resolution.
 */

import { realpath } from "node:fs/promises";
import type { Skill } from "../types.ts";
import { matchesPattern } from "./pathActivator.ts";

/**
 * Tracks a skill and its source for deduplication
 */
interface RegistryEntry {
  skill: Skill;
  realPath: string;
  source: "bundled" | "user" | "project" | "mode" | "mcp";
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
  private activatedConditionalSkills: Set<string> = new Set(); // Activated conditional skill names
  private sourceCounts: Map<
    string,
    { count: number; duplicates: number }
  > = new Map(); // Track counts per source

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
    // Track this registration for stats
    if (!this.sourceCounts.has(source)) {
      this.sourceCounts.set(source, { count: 0, duplicates: 0 });
    }
    const stats = this.sourceCounts.get(source)!;
    stats.count++;

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

    // If file already registered, count as duplicate
    if (this.entries.has(realPath)) {
      stats.duplicates++;
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
   * - Source tracking counts
   * - Activated conditional skills
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
    this.activatedConditionalSkills.clear();
    this.sourceCounts.clear();
  }

  /**
   * Get all skills with conditional activation paths
   *
   * Returns only skills that have a `paths?` field defined.
   * These skills are only available when file paths match.
   *
   * @returns Array of conditional skills
   */
  getConditionalSkills(): Skill[] {
    return this.getAll().filter((skill) => skill.paths && skill.paths.length > 0);
  }

  /**
   * Get all skills without conditional activation paths
   *
   * Returns only skills that don't have a `paths?` field defined.
   * These skills are always available.
   *
   * @returns Array of unconditional skills
   */
  getUnconditionalSkills(): Skill[] {
    return this.getAll().filter((skill) => !skill.paths || skill.paths.length === 0);
  }

  /**
   * Activate skills based on file path
   *
   * Checks all conditional skills to see if any match the given file path.
   * Once a skill is activated, it remains activated for the entire session.
   *
   * **Algorithm:**
   * 1. Get all conditional skills
   * 2. For each conditional skill, check if file matches its patterns
   * 3. If matches, add skill name to activated set (never removed)
   * 4. Activated skills are included in context window alongside unconditional skills
   *
   * **Performance:** O(n*m) where n=conditional skills, m=avg patterns per skill
   * Typically <1ms for 100 conditional skills with 2-3 patterns each.
   *
   * @param filePath - File path to check (e.g., "src/Makefile")
   * @example
   * ```typescript
   * registry.activateSkillsForFile("Makefile");
   * // Any conditional skill with paths: ["Makefile"] is now activated
   * ```
   */
  activateSkillsForFile(filePath: string): void {
    const conditionalSkills = this.getConditionalSkills();

    for (const skill of conditionalSkills) {
      if (skill.paths && matchesPattern(filePath, skill.paths)) {
        this.activatedConditionalSkills.add(skill.name);
      }
    }
  }

  /**
   * Get all currently active skills
   *
   * Combines:
   * - All unconditional skills
   * - All conditional skills that have been activated
   *
   * This is the set of skills that should be included in the context window.
   *
   * @returns Array of active skills
   */
  getActiveSkills(): Skill[] {
    const active: Skill[] = [];

    for (const skill of this.getAll()) {
      // Include unconditional skills
      if (!skill.paths || skill.paths.length === 0) {
        active.push(skill);
        continue;
      }

      // Include activated conditional skills
      if (this.activatedConditionalSkills.has(skill.name)) {
        active.push(skill);
      }
    }

    return active;
  }

  /**
   * Get statistics about skill categorization and activation
   *
   * Useful for understanding skill composition and context window impact.
   *
   * @returns Object with detailed stats
   * @example
   * ```typescript
   * const stats = registry.getSkillStats();
   * console.log(`${stats.total} total (${stats.unconditional} unconditional, ${stats.conditional} conditional) | ${stats.active} currently active`);
   * // Output: "150 total (100 unconditional, 50 conditional) | 105 currently active"
   * ```
   */
  getSkillStats(): {
    total: number;
    unconditional: number;
    conditional: number;
    active: number;
    activeConditional: number;
  } {
    const allSkills = this.getAll();
    const conditionalSkills = allSkills.filter((s) => s.paths && s.paths.length > 0);
    const unconditionalSkills = allSkills.filter((s) => !s.paths || s.paths.length === 0);

    return {
      total: allSkills.length,
      unconditional: unconditionalSkills.length,
      conditional: conditionalSkills.length,
      active: unconditionalSkills.length + this.activatedConditionalSkills.size,
      activeConditional: this.activatedConditionalSkills.size,
    };
  }

  /**
   * Get discovery statistics showing skills loaded from each source
   *
   * Useful for startup reporting and debugging:
   * ```
   * const stats = registry.getDiscoveryStats();
   * console.log(`Loaded ${stats.reduce((sum, s) => sum + s.count, 0)} unique skills from ${stats.length} sources`);
   * console.log(`Duplicates filtered: ${stats.reduce((sum, s) => sum + s.duplicates, 0)}`);
   * ```
   *
   * **Output Example:**
   * ```typescript
   * [
   *   { sourceName: 'project', count: 5, duplicates: 0 },
   *   { sourceName: 'user', count: 12, duplicates: 1 },
   *   { sourceName: 'bundled', count: 45, duplicates: 3 },
   *   { sourceName: 'additional', count: 2, duplicates: 0 },
   * ]
   * ```
   *
   * @returns Array of discovery stats per source, ordered by discovery priority
   */
  getDiscoveryStats(): Array<{
    sourceName: string;
    count: number;
    duplicates: number;
  }> {
    // Return stats in priority order
    const sources = ["project", "user", "bundled", "additional", "mode"];
    return sources
      .map((source) => ({
        sourceName: source,
        count: this.sourceCounts.get(source)?.count ?? 0,
        duplicates: this.sourceCounts.get(source)?.duplicates ?? 0,
      }))
      .filter((stat) => stat.count > 0);
  }

  /**
   * Get the set of currently activated conditional skill names
   *
   * Useful for debugging and testing.
   *
   * @returns Set of skill names that are currently activated
   * @internal For debugging/testing purposes
   */
  getActivatedConditionalSkillNames(): Set<string> {
    return new Set(this.activatedConditionalSkills);
  }

  /**
   * Check if a skill is currently active
   *
   * @param skillName - Name of skill to check
   * @returns true if skill is active (unconditional or activated conditional)
   */
  isSkillActive(skillName: string): boolean {
    const skill = this.get(skillName);
    if (!skill) return false;

    // Unconditional skills are always active
    if (!skill.paths || skill.paths.length === 0) {
      return true;
    }

    // Conditional skills are active only if activated
    return this.activatedConditionalSkills.has(skillName);
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

  /**
   * Get all MCP skills in the registry
   *
   * **Features:**
   * - Filters skills by isMCPSkill: true
   * - Includes trust level information
   * - Shows which server each skill came from
   *
   * @returns Array of MCP skills, sorted by name
   * @example
   * ```typescript
   * const mcpSkills = registry.getMcpSkills();
   * console.log(`${mcpSkills.length} MCP skills loaded`);
   * ```
   */
  getMcpSkills(): Skill[] {
    return this.getAll().filter((skill) => skill.isMCPSkill);
  }

  /**
   * Get MCP-specific load statistics
   *
   * **Output Format:**
   * ```
   * "Loaded 12 MCP skills from 3 servers (5 blocked for security)"
   * ```
   *
   * Includes:
   * - Total MCP skills loaded
   * - Unique MCP servers
   * - Security filtering statistics
   * - Trust level breakdown
   *
   * @returns Object with MCP loading statistics
   * @example
   * ```typescript
   * const stats = registry.getMcpLoadStats();
   * console.log(stats.summary); // "Loaded 12 MCP skills from 3 servers..."
   * console.log(stats.trusted); // 2 skills
   * console.log(stats.untrusted); // 10 skills
   * ```
   */
  getMcpLoadStats(): {
    totalMcpSkills: number;
    uniqueServers: number;
    trusted: number;
    untrusted: number;
    summary: string;
  } {
    const mcpSkills = this.getMcpSkills();
    const servers = new Set(
      mcpSkills.map((skill) => skill.mcpServer).filter(Boolean),
    );
    const trusted = mcpSkills.filter(
      (skill) => skill.trustLevel === "trusted",
    ).length;
    const untrusted = mcpSkills.filter(
      (skill) => skill.trustLevel === "untrusted",
    ).length;

    const summary =
      mcpSkills.length === 0
        ? "No MCP skills loaded"
        : `Loaded ${mcpSkills.length} MCP skills from ${servers.size} server${servers.size === 1 ? "" : "s"} (${untrusted} untrusted)`;

    return {
      totalMcpSkills: mcpSkills.length,
      uniqueServers: servers.size,
      trusted,
      untrusted,
      summary,
    };
  }

  /**
   * Get MCP skills by server
   *
   * Groups skills by their source MCP server for analysis.
   *
   * @returns Map of server name -> skills
   * @example
   * ```typescript
   * const byServer = registry.getMcpSkillsByServer();
   * for (const [serverName, skills] of byServer) {
   *   console.log(`${serverName}: ${skills.length} skills`);
   * }
   * ```
   */
  getMcpSkillsByServer(): Map<string, Skill[]> {
    const mcpSkills = this.getMcpSkills();
    const byServer = new Map<string, Skill[]>();

    for (const skill of mcpSkills) {
      const server = skill.mcpServer || "unknown";
      if (!byServer.has(server)) {
        byServer.set(server, []);
      }
      byServer.get(server)!.push(skill);
    }

    return byServer;
  }

  /**
   * Get comprehensive deduplication statistics
   *
   * **Purpose:**
   * Provides detailed metrics about skill deduplication for reporting and testing.
   * Shows how many skills were deduplicated overall, per source, and file paths resolved.
   *
   * **Output Example:**
   * ```typescript
   * const stats = registry.getDedupStats();
   * // {
   * //   totalPaths: 87,
   * //   uniqueSkills: 82,
   * //   totalDuplicates: 5,
   * //   realPathCacheSize: 82,
   * //   bySource: [
   * //     { source: 'bundled', registered: 45, duplicates: 2 },
   * //     { source: 'user', registered: 25, duplicates: 1 },
   * //     { source: 'mcp', registered: 12, duplicates: 2 },
   * //   ]
   * // }
   * ```
   *
   * **Usage:**
   * - Verify deduplication is working correctly in tests
   * - Monitor startup performance
   * - Debug duplicate resolution
   *
   * @returns Object with detailed dedup statistics
   */
  getDedupStats(): {
    totalPaths: number;
    uniqueSkills: number;
    totalDuplicates: number;
    realPathCacheSize: number;
    bySource: Array<{ source: string; registered: number; duplicates: number }>;
  } {
    const totalDuplicates = Array.from(this.sourceCounts.values()).reduce(
      (sum, stat) => sum + stat.duplicates,
      0,
    );
    
    const totalPaths = Array.from(this.sourceCounts.values()).reduce(
      (sum, stat) => sum + stat.count,
      0,
    );

    const bySource = Array.from(this.sourceCounts.entries())
      .map(([source, stats]) => ({
        source,
        registered: stats.count,
        duplicates: stats.duplicates,
      }))
      .sort((a, b) => b.registered - a.registered);

    return {
      totalPaths,
      uniqueSkills: this.entries.size,
      totalDuplicates,
      realPathCacheSize: this.realPathCache.size,
      bySource,
    };
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
