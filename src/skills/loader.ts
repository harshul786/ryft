import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Mode, Skill } from "../types.ts";
import type { SkillSourcesConfig } from "../config/skillSources.ts";
import { getGlobalSkillRegistry } from "./registry.ts";
import { enrichSkillFromFile } from "./frontmatter.ts";
import { fetchMcpSkillsForClient } from "./mcpSkills.ts";
import { filterSkillsForSecurity } from "./mcpSkillFilters.ts";
import { FileWatcher } from "../utils/skillChangeDetector.ts";
import {
  resolveDependencies,
  detectVersionConflicts,
} from "./versionResolver.ts";
import { getGlobalAnalyticsStore } from "./analytics.ts";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

// Memoization cache: modes key -> skills array
const discoveryCache = new Map<string, Skill[]>();

// Error and statistics tracking
interface LoadStats {
  total: number;
  loaded: number;
  failed: number;
  skipped: number;
  errors: Array<{ file: string; reason: string }>;
}

let lastLoadStats: LoadStats = {
  total: 0,
  loaded: 0,
  failed: 0,
  skipped: 0,
  errors: [],
};
const DEBUG = process.env.DEBUG_SKILLS === "true";

/**
 * Parse basic skill metadata from file content (fallback if enrichment fails)
 *
 * Extracts:
 * - name: from frontmatter `name:` or `title:` fields
 * - description: from frontmatter or first 3 lines of content
 *
 * @param text - Raw file content
 * @param fallbackName - Name to use if not found in content (usually directory name)
 * @returns Partial Skill object with basic metadata
 */
function parseSkillMetadata(text: string, fallbackName: string): Skill {
  const nameMatch =
    text.match(/^name:\s*(.+)$/m) || text.match(/^title:\s*(.+)$/m);
  const descriptionMatch = text.match(/^description:\s*(.+)$/m);
  return {
    name: nameMatch?.[1]?.trim() || fallbackName,
    description:
      descriptionMatch?.[1]?.trim() ||
      text.split("\n").slice(0, 3).join(" ").trim(),
  };
}

/**
 * Generate a cache key from a set of modes
 *
 * Sorts mode names to ensure consistent cache keys regardless of input order.
 * Example: modes [coder, debugger] and [debugger, coder] produce same key.
 *
 * @param modes - Array of Mode objects
 * @returns String key for cache lookup
 */
function generateCacheKey(modes: Mode[]): string {
  return modes
    .map((m) => m.name)
    .sort()
    .join(",");
}

/**
 * Scan a directory for skill files and load them
 *
 * Looks for:
 * - Subdirectories containing SKILL.md (one skill per directory)
 * - Top-level SKILL.md files (if directory contains multiple skills)
 *
 * Parses frontmatter and enriches standard skill metadata.
 * Silently skips malformed files, logs warnings.
 *
 * @param dirPath - Absolute path to directory to scan
 * @returns Array of loaded Skill objects
 */
async function loadSkillDir(dirPath: string): Promise<Skill[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    lastLoadStats.total += entries.length;

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const skillFile = path.join(entryPath, "SKILL.md");
        try {
          await stat(skillFile);
          files.push(skillFile);
          DEBUG && console.debug(`[Skills] Found skill: ${skillFile}`);
        } catch {
          // No SKILL.md in this directory, skip
          lastLoadStats.skipped++;
          continue;
        }
      } else if (entry.isFile() && entry.name.toLowerCase() === "skill.md") {
        files.push(entryPath);
        DEBUG && console.debug(`[Skills] Found top-level skill: ${entryPath}`);
      }
    }
  } catch (error) {
    // Directory doesn't exist or isn't readable
    const reason = error instanceof Error ? error.message : String(error);
    DEBUG &&
      console.debug(`[Skills] Failed to scan directory ${dirPath}: ${reason}`);
    return [];
  }

  const skills: Skill[] = [];
  for (const file of files) {
    try {
      const text = await readFile(file, "utf8");
      const baseSkill = parseSkillMetadata(
        text,
        path.basename(path.dirname(file)),
      );
      baseSkill.file = file;

      // Enrich skill with full metadata from frontmatter
      const enriched = await enrichSkillFromFile(baseSkill, file);
      skills.push(enriched);
      lastLoadStats.loaded++;
      DEBUG && console.debug(`[Skills] Loaded: ${enriched.name} from ${file}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      lastLoadStats.failed++;
      lastLoadStats.errors.push({ file, reason });
      console.warn(`[Skills] Failed to load skill from ${file}: ${reason}`);
    }
  }
  return skills;
}

/**
 * Load skills from multiple directories in parallel
 *
 * Concurrently scans all provided directories for SKILL.md files.
 * If any directory fails to load, continues with others (graceful degradation).
 *
 * @param dirPaths - Array of absolute directory paths to scan
 * @returns Flattened array of all skills found across all directories
 */
async function loadSkillsFromDirs(dirPaths: string[]): Promise<Skill[]> {
  DEBUG &&
    console.debug(`[Skills] Loading from ${dirPaths.length} directories`);
  const results = await Promise.all(
    dirPaths.map((dirPath) => loadSkillDir(dirPath)),
  );
  return results.flat();
}

/**
 * Discover all skills for given modes with deduplication and caching
 *
 * **Caching:** Results are memoized by mode set. Second call with same modes
 * returns cached result in <1ms. Call `clearDiscoveryCache()` to reset.
 *
 * **Pipeline:**
 * 1. Collect all skillRoots from modes (deduplicated)
 * 2. Parallel scan all directories for SKILL.md files
 * 3. Parse frontmatter and enrich metadata for each skill
 * 4. Register in global SkillRegistry (auto-deduplicates by realpath)
 * 5. Fetch MCP skills from configured servers
 * 6. Filter MCP skills for security boundaries
 * 7. Register MCP skills in registry
 * 8. Sort by name
 * 9. Cache by mode set
 *
 * **Performance:**
 * - First call: ~2ms (parallel filesystem I/O + parsing) + ~5ms (MCP fetch with cache hits)
 * - Cached call: <1ms (map lookup)
 * - Gracefully handles missing directories or offline MCP servers
 *
 * @param modes - Array of Mode objects to discover skills for
 * @returns Promise<Skill[]> - Deduped skills (bundled + MCP) available in these modes, sorted by name
 * @throws Never - gracefully handles errors, logs warnings
 */
export async function discoverAllSkillsForModes(
  modes: Mode[],
): Promise<Skill[]> {
  // Check cache first
  const cacheKey = generateCacheKey(modes);
  if (discoveryCache.has(cacheKey)) {
    DEBUG && console.debug(`[Skills] Cache hit for modes: ${cacheKey}`);
    return discoveryCache.get(cacheKey)!;
  }

  DEBUG &&
    console.debug(
      `[Skills] Discovering skills for modes: ${modes.map((m) => m.name).join(", ")}`,
    );

  // Reset stats for this discovery run
  lastLoadStats = { total: 0, loaded: 0, failed: 0, skipped: 0, errors: [] };

  // Collect all skill roots from modes
  const skillRoots = [
    ...new Set(modes.flatMap((mode) => mode.skillRoots ?? [])),
  ];
  DEBUG &&
    console.debug(`[Skills] Using skill roots: ${skillRoots.join(", ")}`);

  // Convert to absolute paths
  const absolutePaths = skillRoots.map((root) => path.join(projectRoot, root));

  // Load skills in parallel
  const loadedSkills = await loadSkillsFromDirs(absolutePaths);
  DEBUG &&
    console.debug(
      `[Skills] Parallel load complete: ${loadedSkills.length} skills before dedup`,
    );

  // Get registry and register all skills
  const registry = getGlobalSkillRegistry();

  for (const skill of loadedSkills) {
    await registry.register(skill, "mode");
  }

  // FEATURE 3: Fetch and integrate MCP skills
  const mcpServers = [
    ...new Set(modes.flatMap((mode) => mode.mcpServers ?? [])),
  ];

  let mcpSkills: Skill[] = [];
  if (mcpServers.length > 0) {
    DEBUG &&
      console.debug(
        `[Skills] Fetching MCP skills from ${mcpServers.length} servers...`,
      );
    try {
      mcpSkills = await fetchMcpSkillsForClient(mcpServers);
      DEBUG &&
        console.debug(
          `[Skills] Fetched ${mcpSkills.length} MCP skills (before filtering)`,
        );

      // Apply security filtering to MCP skills
      const filteredMcpSkills = filterSkillsForSecurity(mcpSkills);
      DEBUG &&
        console.debug(
          `[Skills] Filtered to ${filteredMcpSkills.length} safe MCP skills`,
        );

      mcpSkills = filteredMcpSkills;

      // Register MCP skills in registry
      for (const skill of mcpSkills) {
        await registry.register(skill, "mcp");
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[Skills] Failed to load MCP skills: ${reason}`);
    }
  }

  // Get deduplicated skills from registry
  const dedupedSkills = registry.getAll();
  const discoveryStats = registry.getDiscoveryStats();

  // Calculate dedup statistics
  const totalPathsLoaded = loadedSkills.length + mcpSkills.length;
  const totalUnique = dedupedSkills.length;
  const totalDuplicates = discoveryStats.reduce(
    (sum, stat) => sum + stat.duplicates,
    0,
  );

  DEBUG &&
    console.debug(
      `[Skills] After dedup: ${dedupedSkills.length} unique skills (${loadedSkills.length} bundled + ${mcpSkills.length} MCP)`,
    );

  // Log comprehensive dedup statistics
  console.log(
    `[Skills] Deduplication summary: ${totalPathsLoaded} total paths → ${totalUnique} unique skills (${totalDuplicates} duplicates filtered)`,
  );

  // Log per-source statistics
  for (const stat of discoveryStats) {
    const dedupMsg =
      stat.duplicates > 0 ? ` (-${stat.duplicates} duplicates)` : "";
    console.log(`[Skills]   ${stat.sourceName}: ${stat.count}${dedupMsg}`);
  }

  // FEATURE 8: Version and dependency tracking
  const skillRegistry = new Map<string, Skill>(
    dedupedSkills.map((s) => [s.name, s]),
  );

  // Count versioned skills and show version info
  const versionedSkills = dedupedSkills.filter((s) => s.version);
  if (versionedSkills.length > 0) {
    console.log(
      `[Skills] Version info: ${versionedSkills.length} skills with versions`,
    );
    versionedSkills.slice(0, 5).forEach((s) => {
      console.log(`[Skills]   ${s.name}: v${s.version}`);
    });
    if (versionedSkills.length > 5) {
      console.log(
        `[Skills]   ...and ${versionedSkills.length - 5} more versioned skills`,
      );
    }
  }

  // Validate dependencies and detect conflicts
  const allConflicts: Array<{ skill: string; message: string }> = [];
  for (const skill of dedupedSkills) {
    if (skill.dependencies && Object.keys(skill.dependencies).length > 0) {
      const resolved = resolveDependencies(skill, skillRegistry);
      for (const dep of resolved) {
        if (!dep.isSatisfied) {
          allConflicts.push({
            skill: skill.name,
            message: `⚠️  skill '${skill.name}' requires '${dep.skillName}@${dep.requiredVersion}' (have ${dep.actualVersion || "unavailable"})`,
          });
        }
      }
    }
  }

  // Detect version conflicts
  const conflicts = detectVersionConflicts(skillRegistry);
  for (const conflict of conflicts) {
    if (conflict.conflictingDependents.length > 0) {
      const dependents = conflict.conflictingDependents
        .map((d) => `${d.skillName}@${d.requiredVersion}`)
        .join(", ");
      allConflicts.push({
        skill: conflict.skillName,
        message: `⚠️  version conflict: '${conflict.skillName}@${conflict.version}' required by: ${dependents}`,
      });
    }
  }

  // Log conflicts
  if (allConflicts.length > 0) {
    console.warn(
      `[Skills] Found ${allConflicts.length} dependency/version conflicts:`,
    );
    allConflicts.slice(0, 10).forEach((c) => {
      console.warn(`[Skills] ${c.message}`);
    });
    if (allConflicts.length > 10) {
      console.warn(
        `[Skills] ...and ${allConflicts.length - 10} more conflicts`,
      );
    }
  }

  // Log load statistics if there were errors
  if (lastLoadStats.failed > 0 || lastLoadStats.errors.length > 0) {
    console.warn(
      `[Skills] Load stats - Loaded: ${lastLoadStats.loaded}, Failed: ${lastLoadStats.failed}, Skipped: ${lastLoadStats.skipped}`,
    );
    lastLoadStats.errors.slice(0, 5).forEach((e) => {
      console.warn(`[Skills] Error: ${e.file} - ${e.reason}`);
    });
    if (lastLoadStats.errors.length > 5) {
      console.warn(
        `[Skills] ...and ${lastLoadStats.errors.length - 5} more errors`,
      );
    }
  }

  // Cache result
  discoveryCache.set(cacheKey, dedupedSkills);

  // Emit load signal
  registry.emitLoad();

  return dedupedSkills;
}

/**
 * Clear discovery cache and registry
 *
 * Call this when:
 * - Skill files have been added/removed/modified
 * - Modes configuration has changed
 * - Want to force fresh discovery (e.g., for testing)
 *
 * After calling, next `discoverAllSkillsForModes()` will fully rescan.
 */
export function clearDiscoveryCache(): void {
  DEBUG && console.debug("[Skills] Clearing discovery cache and registry");
  discoveryCache.clear();
  getGlobalSkillRegistry().clear();
}

/**
 * Get load statistics from last discovery run
 *
 * Useful for debugging and monitoring:
 * ```
 * const stats = getLoadStats();
 * console.log(`Loaded ${stats.loaded} skills, ${stats.failed} failed`);
 * ```
 *
 * @returns LoadStats object with counts and error details
 */
export function getLoadStats(): LoadStats {
  return { ...lastLoadStats };
}

/**
 * Log startup analytics about skills and tools
 *
 * Displays:
 * - Total skills count (unconditional + conditional)
 * - Active skills count
 * - Tool permission summary
 * - Recently used skills (from analytics)
 *
 * Called during startup to give users visibility into skill composition
 * and tool permissions. Uses registry and analytics data.
 *
 * Example output:
 * ```
 * [Skills] Analytics: 50 total (30 unconditional, 20 conditional) | 32 currently active
 * [Skills] Tool permissions: read(15), write(8), execute(22)
 * [Skills] Top 3 skills: format, test, build
 * ```
 */
export function logStartupAnalytics(): void {
  const registry = getGlobalSkillRegistry();
  const analytics = getGlobalAnalyticsStore();

  // Get skill statistics
  const stats = registry.getSkillStats();
  const skillsMsg = `Skills: ${stats.total} total (${stats.unconditional} unconditional, ${stats.conditional} conditional) | ${stats.active} currently active`;
  console.log(`[Skills] ${skillsMsg}`);

  // Get tool permission summary from analytics
  const toolPerms = analytics.getToolPermissionSummary();
  const toolEntries = Object.entries(toolPerms)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${type}(${count})`)
    .join(", ");

  if (toolEntries.length > 0) {
    console.log(`[Skills] Tool permissions: ${toolEntries}`);
  }

  // Get top skills from analytics
  const analyticsData = analytics.getAnalytics();
  if (analyticsData.topSkills.length > 0) {
    const topSkillsNames = analyticsData.topSkills
      .slice(0, 3)
      .map((s) => s.name);
    console.log(`[Skills] Recently used: ${topSkillsNames.join(", ")}`);
  }

  DEBUG &&
    console.debug(
      `[Analytics] Skills tracked: ${analyticsData.totalSkillsTracked}, Total invocations: ${analyticsData.totalInvocations}, Success rate: ${analyticsData.successRate}%`,
    );
}

/**
 * Initialize hot-reload skill watcher
 *
 * **Features:**
 * - Monitors all configured skill directories (project, user, bundled, additional)
 * - Auto-invalidates discovery cache on file changes
 * - Respects .gitignore patterns
 * - Safely handles permission errors and missing directories
 * - DEVELOPMENT MODE: Disabled if RYFT_DISABLE_SKILL_WATCHER=true or NODE_ENV=production
 *
 * **Performance:**
 * - Watcher setup: ~10-50ms (one-time cost)
 * - File change detection: <5ms
 * - Debouncing: 300ms batch window (prevents thrashing on rapid edits)
 * - Memory: ~5-10MB per watcher (minimal overhead)
 *
 * **Example:**
 * ```typescript
 * const skillSources = {
 *   project: ['/project/.ryft/skills'],
 *   user: homedir() + '/.ryft/skills',
 *   bundled: ['packs/coder/skills'],
 *   additional: []
 * };
 * const watcher = await initializeSkillWatcher(skillSources);
 * // ... later
 * await watcher?.close();
 * ```
 *
 * @param skillSources - Configuration object with skill directories
 * @returns Promise<FileWatcher | null> - watcher instance (or null if disabled/error)
 * @throws Never - catches and logs errors, returns null gracefully
 */
export async function initializeSkillWatcher(
  skillSources: SkillSourcesConfig,
): Promise<FileWatcher | null> {
  // Check if watcher is disabled
  if (
    process.env.RYFT_DISABLE_SKILL_WATCHER === "true" ||
    process.env.NODE_ENV === "production"
  ) {
    DEBUG && console.debug("[Skills] Skill watcher disabled (env override)");
    return null;
  }

  // Collect all skill directories to watch
  const dirsToWatch: string[] = [];

  // Add project directories
  if (skillSources.project && Array.isArray(skillSources.project)) {
    dirsToWatch.push(...skillSources.project);
  }

  // Add user directory (if exists in config)
  if (skillSources.user) {
    dirsToWatch.push(skillSources.user);
  }

  // Add bundled skill directories
  if (skillSources.bundled && Array.isArray(skillSources.bundled)) {
    dirsToWatch.push(...skillSources.bundled);
  }

  // Add additional directories
  if (skillSources.additional && Array.isArray(skillSources.additional)) {
    dirsToWatch.push(...skillSources.additional);
  }

  if (dirsToWatch.length === 0) {
    DEBUG && console.debug("[Skills] No skill directories to watch");
    return null;
  }

  try {
    const watcher = new FileWatcher({
      directories: dirsToWatch,
      debounceMs: 300,
      onFilesChanged: async () => {
        DEBUG && console.debug("[Skills] Hot reload triggered, clearing cache");
        clearDiscoveryCache();
        // Note: Skills will be re-discovered on next request
        // (when user inputs new command or resizes terminal)
      },
    });

    await watcher.watch();
    DEBUG &&
      console.debug(
        `[Skills] Skill watcher initialized (${dirsToWatch.length} directories)`,
      );
    return watcher;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[Skills] Failed to initialize skill watcher: ${reason}`);
    return null;
  }
}

/**
 * Legacy wrapper for backwards compatibility
 *
 * @deprecated Use `discoverAllSkillsForModes()` instead
 * @param modes - Array of Mode objects
 * @returns Promise resolving to array of Skills
 */
export async function loadSkillsForModes(modes: Mode[]): Promise<Skill[]> {
  return discoverAllSkillsForModes(modes);
}
