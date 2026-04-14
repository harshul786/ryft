/**
 * MCP Skills Security Filters
 *
 * Implements security boundaries for MCP skills:
 * - Blocks: inline shell execution from untrusted MCP sources
 * - Allows: read-only operations (file read, inspect, query)
 * - Warns: requires admin approval before first execution
 * - Categories: read, write, execute
 */

import type { Skill } from "../types.ts";

/**
 * Tool security category
 */
export type ToolCategory = "read" | "write" | "execute";

/**
 * Tool categorization rules
 * Maps tool name patterns to security categories
 */
const TOOL_CATEGORIES: Record<ToolCategory, RegExp[]> = {
  read: [
    /^read/i,
    /^list/i,
    /^get/i,
    /^fetch/i,
    /^query/i,
    /^search/i,
    /^inspect/i,
    /^show/i,
    /^view/i,
    /^peek/i,
  ],
  write: [
    /^write/i,
    /^create/i,
    /^update/i,
    /^delete/i,
    /^remove/i,
    /^edit/i,
    /^modify/i,
    /^save/i,
    /^mkdir/i,
    /^touch/i,
  ],
  execute: [
    /^exec/i,
    /^run/i,
    /^shell/i,
    /^bash/i,
    /^sh$/i,
    /^command/i,
    /^cmd/i,
    /^invoke/i,
    /^call/i,
    /^spawn/i,
  ],
};

/**
 * Dangerous tool patterns that should always be blocked
 * Rules:
 * - Prevents code injection vectors
 * - Blocks unrestricted shell access
 * - Prevents resource exhaustion
 */
const DANGEROUS_PATTERNS = [
  /^(exec|eval|eval_code|system_shell)/i, // Unrestricted code execution
  /^(shell_exec|bash_exec|sh_exec)/i, // Direct shell access
  /^(fork|spawn|exec_process)/i, // Process spawning
  /^(download|curl|wget|fetch_url)/i, // Remote code loading
  /^(install|pip|npm|package_install)/i, // Package/dependency installation
];

/**
 * Categorize a tool by its name
 *
 * **Rules:**
 * - If tool matches execute patterns → 'execute'
 * - Else if tool matches write patterns → 'write'
 * - Else if tool matches read patterns → 'read' (default)
 *
 * @param toolName - Name of the tool to categorize
 * @returns Tool category (read, write, or execute)
 *
 * @example
 * ```typescript
 * categorizeTool('read_file'); // 'read'
 * categorizeTool('write_file'); // 'write'
 * categorizeTool('exec_command'); // 'execute'
 * ```
 */
export function categorizeTool(toolName: string): ToolCategory {
  // Check dangerous patterns first
  if (DANGEROUS_PATTERNS.some((pattern) => pattern.test(toolName))) {
    return "execute"; // Treats dangerous tools as execute (most restrictive)
  }

  // Check in order of restriction (execute > write > read)
  for (const pattern of TOOL_CATEGORIES.execute) {
    if (pattern.test(toolName)) return "execute";
  }

  for (const pattern of TOOL_CATEGORIES.write) {
    if (pattern.test(toolName)) return "write";
  }

  // Default to read (most permissive)
  return "read";
}

/**
 * Filter result for unsafe tools
 */
export interface FilterResult {
  safe: boolean;
  reason?: string;
  category?: ToolCategory;
  approval?: "required" | "not-required";
}

/**
 * Check if a skill's tools look unsafe (from untrusted source)
 *
 * **Security Rules for Untrusted MCP Skills:**
 * 1. Block: execute category tools (shell execution) → NOT ALLOWED
 * 2. Warn: write category tools → APPROVAL REQUIRED
 * 3. Allow: read category tools (default) → NO APPROVAL NEEDED
 *
 * **Examples:**
 * - read_file → ALLOWED (read category)
 * - write_file → WARN (write category, approval required)
 * - exec_command → BLOCKED (execute category)
 *
 * @param skill - Skill to filter (should have isMCPSkill: true)
 * @returns FilterResult indicating if skill is safe and any warnings
 *
 * @example
 * ```typescript
 * const skill = {
 *   name: 'execute_shell',
 *   description: 'Run shell commands',
 *   isMCPSkill: true,
 *   trustLevel: 'untrusted'
 * };
 *
 * const result = filterUnsafeTools(skill);
 * console.log(result.safe); // false
 * console.log(result.reason); // 'Shell execution blocked for untrusted MCP skill'
 * ```
 */
export function filterUnsafeTools(skill: Skill): FilterResult {
  // Only filter untrusted MCP skills
  if (!skill.isMCPSkill || skill.trustLevel === "trusted") {
    return { safe: true, approval: "not-required" };
  }

  const category = categorizeTool(skill.name);

  // Execute tools are blocked for untrusted MCP skills
  if (category === "execute") {
    return {
      safe: false,
      reason: `Shell execution blocked for untrusted MCP skill: ${skill.name}`,
      category,
      approval: "required",
    };
  }

  // Write tools require approval
  if (category === "write") {
    return {
      safe: true, // Allowed but with warning
      reason: `Write operation requires admin approval: ${skill.name}`,
      category,
      approval: "required",
    };
  }

  // Read tools are allowed without approval
  return {
    safe: true,
    reason: "Read-only operation allowed without approval",
    category,
    approval: "not-required",
  };
}

/**
 * Filter an array of skills and return only safe ones
 *
 * Removes dangerous skills from the list entirely.
 * Suspicious skills (write category) are kept but marked for approval.
 *
 * @param skills - Array of skills to filter
 * @returns Filtered skills (dangerous ones removed)
 */
export function filterSkillsForSecurity(skills: Skill[]): Skill[] {
  return skills.filter((skill) => {
    const result = filterUnsafeTools(skill);
    if (!result.safe) {
      console.warn(
        `[MCP Skills] Filtered out unsafe skill: ${skill.name} - ${result.reason}`,
      );
      return false;
    }
    return true;
  });
}

/**
 * Get status report for a skill's security level
 *
 * Returns human-readable status for UI display.
 *
 * @param skill - Skill to report on
 * @returns Status string for display
 *
 * @example
 * ```typescript
 * const status = getSkillSecurityStatus(skill);
 * console.log(status); // "✓ Safe (read-only, no approval needed)"
 * ```
 */
export function getSkillSecurityStatus(skill: Skill): string {
  if (!skill.isMCPSkill) {
    return "✓ Bundled skill (trusted)";
  }

  const result = filterUnsafeTools(skill);

  if (!result.safe) {
    return `⚠ BLOCKED: ${result.reason}`;
  }

  if (result.approval === "required") {
    return `⚠ Warning: ${result.reason} (approval required)`;
  }

  return "✓ Safe (read-only, no approval needed)";
}

/**
 * Statistics about skill security filtering
 */
export interface SecurityStats {
  total: number;
  allowed: number;
  blocked: number;
  requiresApproval: number;
  byCategory: {
    read: number;
    write: number;
    execute: number;
  };
}

/**
 * Analyze security profile of a skill array
 *
 * @param skills - Array of skills to analyze
 * @returns Statistics about security filtering
 */
export function analyzeSecurityProfile(skills: Skill[]): SecurityStats {
  const stats: SecurityStats = {
    total: skills.length,
    allowed: 0,
    blocked: 0,
    requiresApproval: 0,
    byCategory: { read: 0, write: 0, execute: 0 },
  };

  for (const skill of skills) {
    const result = filterUnsafeTools(skill);
    const category = categorizeTool(skill.name);

    stats.byCategory[category]++;

    if (result.safe) {
      stats.allowed++;
      if (result.approval === "required") {
        stats.requiresApproval++;
      }
    } else {
      stats.blocked++;
    }
  }

  return stats;
}
