/**
 * Skill Analytics Module
 *
 * Tracks skill invocations, success rates, tool usage, and provides aggregated analytics.
 * Designed for minimal performance impact with opt-in tracking.
 */

/**
 * Analytics data for a single skill
 */
export interface SkillAnalytics {
  skillName: string;
  invocations: number;
  successes: number;
  failures: number;
  toolsUsed: string[];
  lastUsed: Date | null;
}

/**
 * Aggregated analytics summary
 */
export interface AnalyticsSummary {
  totalSkillsTracked: number;
  totalInvocations: number;
  totalSuccesses: number;
  totalFailures: number;
  successRate: number; // percentage
  topSkills: Array<{
    name: string;
    invocations: number;
    successRate: number;
  }>;
  topTools: Array<{
    name: string;
    usageCount: number;
  }>;
}

/**
 * Exported analytics data for external analysis
 */
export interface ExportedAnalyticsData {
  exportedAt: string;
  summary: AnalyticsSummary;
  skillDetails: SkillAnalytics[];
}

/**
 * Skill Analytics Store - tracks invocations and success metrics
 */
export class SkillAnalyticsStore {
  private analytics: Map<string, SkillAnalytics> = new Map();
  private enabled: boolean;
  private toolPermissions: Map<string, number> = new Map();
  private DEBUG = process.env.DEBUG_ANALYTICS === "true";

  constructor() {
    // Opt-in: only enable if explicitly enabled or not disabled
    this.enabled =
      process.env.RYFT_ANALYTICS !== "false" &&
      process.env.ANALYTICS_DISABLED !== "true";
    this.DEBUG &&
      console.debug(`[Analytics] Initialized (enabled: ${this.enabled})`);
  }

  /**
   * Track a skill invocation
   *
   * Call this when a skill is invoked. Updates invocation count, success/failure,
   * and records tools used. Async-safe for fire-and-forget usage.
   *
   * @param skillName - Name of the skill
   * @param success - Whether the invocation succeeded
   * @param toolsUsed - Optional array of tool names used during invocation
   */
  trackInvocation(
    skillName: string,
    success: boolean,
    toolsUsed?: string[],
  ): void {
    if (!this.enabled) return;

    // Get or create analytics entry
    let entry = this.analytics.get(skillName);
    if (!entry) {
      entry = {
        skillName,
        invocations: 0,
        successes: 0,
        failures: 0,
        toolsUsed: [],
        lastUsed: null,
      };
      this.analytics.set(skillName, entry);
    }

    // Update counts
    entry.invocations++;
    if (success) {
      entry.successes++;
    } else {
      entry.failures++;
    }
    entry.lastUsed = new Date();

    // Record tools used
    if (toolsUsed && toolsUsed.length > 0) {
      for (const tool of toolsUsed) {
        if (!entry.toolsUsed.includes(tool)) {
          entry.toolsUsed.push(tool);
        }
        // Track tool permission counts
        this.toolPermissions.set(
          tool,
          (this.toolPermissions.get(tool) ?? 0) + 1,
        );
      }
    }

    this.DEBUG &&
      console.debug(
        `[Analytics] Tracked: ${skillName} (${success ? "success" : "failure"})`,
      );
  }

  /**
   * Get analytics for a specific skill
   *
   * @param skillName - Name of the skill
   * @returns SkillAnalytics object or undefined if not tracked
   */
  getSkillAnalytics(skillName: string): SkillAnalytics | undefined {
    return this.analytics.get(skillName);
  }

  /**
   * Get all tracked analytics
   *
   * @returns Array of SkillAnalytics objects
   */
  getAllAnalytics(): SkillAnalytics[] {
    return Array.from(this.analytics.values());
  }

  /**
   * Get aggregated analytics summary
   *
   * Includes top 5 skills by invocation count, top tools, and overall stats.
   *
   * @returns AnalyticsSummary object
   */
  getAnalytics(): AnalyticsSummary {
    const allAnalytics = this.getAllAnalytics();

    // Calculate totals
    const totalInvocations = allAnalytics.reduce(
      (sum, a) => sum + a.invocations,
      0,
    );
    const totalSuccesses = allAnalytics.reduce((sum, a) => sum + a.successes, 0);
    const totalFailures = allAnalytics.reduce((sum, a) => sum + a.failures, 0);
    const successRate =
      totalInvocations > 0 ? (totalSuccesses / totalInvocations) * 100 : 0;

    // Get top 5 skills by invocation count
    const topSkills = allAnalytics
      .sort((a, b) => b.invocations - a.invocations)
      .slice(0, 5)
      .map((a) => ({
        name: a.skillName,
        invocations: a.invocations,
        successRate:
          a.invocations > 0 ? (a.successes / a.invocations) * 100 : 0,
      }));

    // Get top 10 tools by usage count
    const sortedTools = Array.from(this.toolPermissions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({
        name,
        usageCount: count,
      }));

    return {
      totalSkillsTracked: allAnalytics.length,
      totalInvocations,
      totalSuccesses,
      totalFailures,
      successRate: Math.round(successRate * 100) / 100,
      topSkills,
      topTools: sortedTools,
    };
  }

  /**
   * Export analytics as JSON
   *
   * Returns complete analytics data including summary and per-skill details.
   * Safe for writing to file or sending to analytics service.
   *
   * @returns ExportedAnalyticsData object
   */
  exportAnalytics(): ExportedAnalyticsData {
    return {
      exportedAt: new Date().toISOString(),
      summary: this.getAnalytics(),
      skillDetails: this.getAllAnalytics(),
    };
  }

  /**
   * Export analytics as JSON string
   *
   * @returns JSON string representation
   */
  exportAnalyticsAsJSON(): string {
    return JSON.stringify(this.exportAnalytics(), null, 2);
  }

  /**
   * Get tool permission summary
   *
   * Returns aggregated counts of each tool type (read, write, execute, etc.)
   * based on tool naming conventions (tool:read, tool:write, etc.)
   *
   * @returns Record with tool type counts
   */
  getToolPermissionSummary(): Record<string, number> {
    const summary: Record<string, number> = {};

    for (const [toolName, count] of this.toolPermissions.entries()) {
      // Try to extract permission type from tool name
      // First try full colon format: "tool:read" -> "read"
      let permType: string | null = null;
      const colonMatch = toolName.match(/:(\w+)$/);
      if (colonMatch) {
        permType = colonMatch[1];
      } else {
        // If no colon, use the tool name itself (e.g., "read", "write", "execute")
        permType = toolName;
      }

      summary[permType] = (summary[permType] ?? 0) + count;
    }

    return summary;
  }

  /**
   * Reset all analytics (for testing or cache clearing)
   */
  reset(): void {
    this.analytics.clear();
    this.toolPermissions.clear();
    this.DEBUG && console.debug("[Analytics] Reset to empty state");
  }

  /**
   * Check if analytics is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get count of unique tools tracked
   */
  getToolCount(): number {
    return this.toolPermissions.size;
  }

  /**
   * Get count of unique skills tracked
   */
  getSkillCount(): number {
    return this.analytics.size;
  }
}

// Global singleton instance
let globalAnalyticsStore: SkillAnalyticsStore | null = null;

/**
 * Get the global analytics store singleton
 *
 * @returns SkillAnalyticsStore instance
 */
export function getGlobalAnalyticsStore(): SkillAnalyticsStore {
  if (!globalAnalyticsStore) {
    globalAnalyticsStore = new SkillAnalyticsStore();
  }
  return globalAnalyticsStore;
}
