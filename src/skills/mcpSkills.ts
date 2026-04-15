/**
 * MCP Skills Integration
 *
 * Fetches and caches skills from MCP servers with security boundaries.
 * Features:
 * - 60-second cache per MCP server (avoids repeated queries)
 * - Graceful error handling (timeout, permission denied → return empty array)
 * - Security marking: all MCP skills marked as isMCPSkill: true, trustLevel: 'untrusted'
 * - Timeout protection: 5-second timeout per server fetch
 */

import type { McpServer, Skill } from "../types.ts";

/**
 * Cache entry for MCP skills
 */
interface McpSkillsCacheEntry {
  skills: Skill[];
  timestamp: number;
  serverName: string;
}

/**
 * MCP skills cache: keyed by server name, stores skills + timestamp
 */
const mcpSkillsCache = new Map<string, McpSkillsCacheEntry>();

/**
 * Cache TTL in milliseconds (60 seconds)
 */
const CACHE_TTL_MS = 60 * 1000;

/**
 * Fetch timeout in milliseconds (5 seconds per server)
 */
const FETCH_TIMEOUT_MS = 5000;

const DEBUG = process.env.DEBUG_MCP_SKILLS === "true";

/**
 * Determines if a tool name looks like it requires shell execution
 *
 * Heuristics for detecting shell execution tools:
 * - Starts with exec, run, shell, bash, sh, cmd, command
 * - Contains "eval" or "execute"
 *
 * @param toolName - Name of the tool
 * @returns true if tool appears to be a shell execution tool
 */
function looksLikeShellExecution(toolName: string): boolean {
  const normalizedName = toolName.toLowerCase();
  const shellPatterns = [
    /^(exec|run|shell|bash|sh|command|cmd|system)/,
    /eval|execute/,
  ];
  return shellPatterns.some((pattern) => pattern.test(normalizedName));
}

/**
 * Convert an MCP tool to a Skill with security markings
 *
 * @param tool - MCP tool definition
 * @param serverName - Name of the MCP server
 * @returns Skill object marked as untrusted MCP skill
 */
function toolToSkill(tool: any, serverName: string): Skill {
  return {
    name: tool.name || "unknown-tool",
    description:
      tool.description || "Tool from MCP server (no description provided)",
    isMCPSkill: true,
    mcpServer: serverName,
    trustLevel: "untrusted", // All MCP skills are untrusted by default
    metadata: {
      title: tool.name || "Unknown",
      description:
        tool.description || "Tool from MCP server (no description provided)",
      version: "1.0",
    },
  };
}

/**
 * Fetch skills from a single MCP server with timeout and error handling
 *
 * **Error Handling:**
 * - Timeout after 5 seconds → return empty array + warning
 * - Connection denied → return empty array + warning
 * - Invalid response → return empty array + warning
 * - Server offline → return empty array + warning
 *
 * **Cache:**
 * - First fetch: queries server
 * - Subsequent fetches within 60s: returns cached result
 * - After 60s: re-fetches from server
 *
 * @param server - MCP server configuration
 * @returns Promise<Skill[]> - Array of skills (empty on error)
 */
async function fetchSkillsFromServer(server: McpServer): Promise<Skill[]> {
  const serverName = server.name;

  // Check cache
  const cacheEntry = mcpSkillsCache.get(serverName);
  if (cacheEntry && Date.now() - cacheEntry.timestamp < CACHE_TTL_MS) {
    DEBUG &&
      console.debug(
        `[MCP Skills] Cache hit for ${serverName} (${cacheEntry.skills.length} skills)`,
      );
    return cacheEntry.skills;
  }

  DEBUG && console.debug(`[MCP Skills] Fetching skills from ${serverName}...`);

  try {
    // TODO: Replace with actual MCP server connection
    // This will use the MCP protocol to fetch resources/skills from the server
    // For now, we return an empty array (stub)
    //
    // Future implementation:
    // 1. Establish connection to MCP server (stdio or HTTP)
    // 2. Call resources/list to get available resources
    // 3. Filter for skill-type resources (name ends with .md, has skill metadata)
    // 4. Return converted skills
    //
    // Example MCP resource protocol call:
    // POST to server with: { jsonrpc: "2.0", method: "resources/list", params: {} }

    const skills: Skill[] = [];

    // Simulate fetch with timeout promise
    const fetchPromise = new Promise<Skill[]>((resolve) => {
      // For now, resolve immediately with empty array
      resolve([]);
    });

    const timeoutPromise = new Promise<Skill[]>((_, reject) => {
      setTimeout(
        () => reject(new Error(`MCP server ${serverName} fetch timeout (>5s)`)),
        FETCH_TIMEOUT_MS,
      );
    });

    const result = await Promise.race([fetchPromise, timeoutPromise]);

    // Cache the result
    mcpSkillsCache.set(serverName, {
      skills: result,
      timestamp: Date.now(),
      serverName,
    });

    DEBUG &&
      console.debug(
        `[MCP Skills] Fetched ${result.length} skills from ${serverName}`,
      );
    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    // Log warning but don't throw - graceful degradation
    console.warn(`[MCP Skills] Failed to fetch from ${serverName}: ${reason}`);

    // Cache empty result to prevent repeated attempts
    mcpSkillsCache.set(serverName, {
      skills: [],
      timestamp: Date.now(),
      serverName,
    });

    return [];
  }
}

/**
 * Fetch skills from all configured MCP servers
 *
 * **Features:**
 * - Parallel fetching (all servers queried concurrently)
 * - Per-server caching (60s TTL)
 * - Graceful error handling (failed servers don't block others)
 * - Security marking (all skills marked isMCPSkill: true, trustLevel: 'untrusted')
 *
 * **Performance:**
 * - First call: max 5s (server timeout) per server, but parallel so ~5s total
 * - Cached calls: <1ms per server (memory lookup)
 * - After 60s: re-fetches (cache expires)
 *
 * @param mcpServers - Array of configured MCP servers
 * @returns Promise<Skill[]> - Combined array of all skills from all servers
 *
 * @example
 * ```typescript
 * const servers = [
 *   { name: 'file-explorer', description: 'Browse files' },
 *   { name: 'web-search', description: 'Search the web' },
 * ];
 * const skills = await fetchMcpSkillsForClient(servers);
 * console.log(`Loaded ${skills.length} MCP skills`);
 * ```
 */
export async function fetchMcpSkillsForClient(
  mcpServers: McpServer[],
): Promise<Skill[]> {
  if (!mcpServers || mcpServers.length === 0) {
    DEBUG && console.debug("[MCP Skills] No MCP servers configured");
    return [];
  }

  DEBUG &&
    console.debug(
      `[MCP Skills] Fetching skills from ${mcpServers.length} servers...`,
    );

  // Fetch from all servers in parallel
  const skillArrays = await Promise.all(
    mcpServers.map((server) => fetchSkillsFromServer(server)),
  );

  // Flatten and deduplicate by name
  const allSkills = skillArrays.flat();
  const uniqueSkills = new Map<string, Skill>();

  for (const skill of allSkills) {
    // Keep track of which servers provide each skill
    const existing = uniqueSkills.get(skill.name);
    if (!existing) {
      uniqueSkills.set(skill.name, skill);
    }
    // Otherwise keep first occurrence (prefer earlier server in list)
  }

  const result = Array.from(uniqueSkills.values());
  DEBUG && console.debug(`[MCP Skills] Total: ${result.length} unique skills`);
  return result;
}

/**
 * Clear MCP skills cache (for testing or manual refresh)
 *
 * @param serverName - Optional: clear cache for specific server only
 *
 * @example
 * ```typescript
 * clearMcpCache('file-explorer'); // Clear one server's cache
 * clearMcpCache(); // Clear all caches
 * ```
 */
export function clearMcpCache(serverName?: string): void {
  if (serverName) {
    mcpSkillsCache.delete(serverName);
    DEBUG && console.debug(`[MCP Skills] Cleared cache for ${serverName}`);
  } else {
    mcpSkillsCache.clear();
    DEBUG && console.debug(`[MCP Skills] Cleared all caches`);
  }
}

/**
 * Get cache stats for debugging/monitoring
 *
 * @returns Object with cache statistics
 */
export function getMcpCacheStats(): {
  servers: number;
  totalSkills: number;
  entries: Array<{ serverName: string; skillCount: number; ageMs: number }>;
} {
  let totalSkills = 0;
  const entries: Array<{
    serverName: string;
    skillCount: number;
    ageMs: number;
  }> = [];

  for (const [serverName, entry] of mcpSkillsCache) {
    const ageMs = Date.now() - entry.timestamp;
    totalSkills += entry.skills.length;
    entries.push({ serverName, skillCount: entry.skills.length, ageMs });
  }

  return {
    servers: mcpSkillsCache.size,
    totalSkills,
    entries,
  };
}
