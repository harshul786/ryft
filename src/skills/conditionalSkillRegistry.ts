/**
 * Conditional Skills Registry
 *
 * Manages conditional (path-based) skills separately from unconditional skills.
 * Tracks activation state and provides efficient queries for active skills.
 */

import type { Skill } from "./types.ts";
import { matchesPattern } from "./pathActivator.ts";

/**
 * Map of conditional skills keyed by skill name
 * Only includes skills with paths? field defined
 */
export type ConditionalSkillsMap = Map<string, Skill>;

/**
 * Tracks which conditional skills are currently active
 */
interface ActivationState {
  /** Set of skill names currently active */
  activeSkills: Set<string>;
  /** Last file path that triggered activation Check */
  lastCheckedPath?: string;
}

/**
 * Conditional Skills Registry
 *
 * Manages separation of conditional and unconditional skills with efficient
 * activation tracking and caching.
 *
 * **Design:**
 * - Unconditional skills always available (contribute to context)
 * - Conditional skills only active when file paths match
 * - Once activated, remain active for entire session (no re-evaluation)
 * - Efficient O(1) activation checks with caching
 *
 * **Context Window Benefits:**
 * For Gemma models with small context windows:
 * - Unconditional: ~100-150 skills
 * - Conditional: ~100-200 additional skills (not loaded initially)
 * - Estimated savings: 30-40% of context window
 *
 * @example
 * ```typescript
 * const registry = new ConditionalSkillRegistry();
 *
 * // Register all skills (automatic separation)
 * for (const skill of allSkills) {
 *   registry.register(skill);
 * }
 *
 * // Activate skills for a specific file
 * registry.activateSkillsForFile('src/Makefile');
 *
 * // Get currently active skills
 * const active = registry.getActiveSkills();
 * ```
 */
export class ConditionalSkillRegistry {
  /** All conditional skills (those with paths? defined) */
  private conditionalSkills: ConditionalSkillsMap = new Map();

  /** All unconditional skills (no paths? defined) */
  private unconditionalSkills: ConditionalSkillsMap = new Map();

  /** Activation tracking: which conditional skills are active */
  private activation: ActivationState = {
    activeSkills: new Set(),
  };

  /**
   * Register a skill, automatically categorizing as conditional or unconditional
   *
   * @param skill - Skill to register
   */
  register(skill: Skill): void {
    const skillMap = skill.paths
      ? this.conditionalSkills
      : this.unconditionalSkills;
    skillMap.set(skill.name, skill);
  }

  /**
   * Get all unconditional skills (always available)
   *
   * These skills should be included in initial context window.
   *
   * @returns Array of unconditional skills
   */
  getUnconditionalSkills(): Skill[] {
    return Array.from(this.unconditionalSkills.values());
  }

  /**
   * Get all conditional skills
   *
   * These skills are only available when file paths match.
   *
   * @returns Array of conditional skills
   */
  getConditionalSkills(): Skill[] {
    return Array.from(this.conditionalSkills.values());
  }

  /**
   * Activate skills based on file path
   *
   * **Algorithm:**
   * 1. For each conditional skill, check if file matches its patterns
   * 2. If matches, add skill name to active set
   * 3. Once activated, never deactivate (persists for session)
   *
   * **Performance:** O(n*m) where n=conditional skills, m=avg patterns per skill
   * Typically <1ms for 100 skills with 2-3 patterns each.
   *
   * @param filePath - File path to check (e.g., "src/Makefile")
   */
  activateSkillsForFile(filePath: string): void {
    this.lastCheckedPath = filePath;

    for (const [skillName, skill] of this.conditionalSkills) {
      if (skill.paths && matchesPattern(filePath, skill.paths)) {
        this.activation.activeSkills.add(skillName);
      }
    }
  }

  /**
   * Get all currently active skills (conditional + unconditional)
   *
   * Combines:
   * - All unconditional skills
   * - All conditional skills that have been activated
   *
   * @returns Array of active skills
   */
  getActiveSkills(): Skill[] {
    const active: Skill[] = [];

    // Add all unconditional skills
    for (const skill of this.unconditionalSkills.values()) {
      active.push(skill);
    }

    // Add activated conditional skills
    for (const skillName of this.activation.activeSkills) {
      const skill = this.conditionalSkills.get(skillName);
      if (skill) {
        active.push(skill);
      }
    }

    return active;
  }

  /**
   * Check if a specific conditional skill is currently active
   *
   * @param skillName - Name of skill to check
   * @returns true if skill is active
   */
  isActive(skillName: string): boolean {
    // Check if it's a unconditional skill
    if (this.unconditionalSkills.has(skillName)) {
      return true;
    }

    // Check if it's an activated conditional skill
    return this.activation.activeSkills.has(skillName);
  }

  /**
   * Get statistics about skill categorization
   *
   * @returns Object with counts of different skill types
   * @example
   * const stats = registry.getStats();
   * console.log(`${stats.total} total (${stats.unconditional} unconditional, ${stats.conditional} conditional) | ${stats.active} currently active`);
   * // Output: "150 total (100 unconditional, 50 conditional) | 5 currently active"
   */
  getStats(): {
    total: number;
    unconditional: number;
    conditional: number;
    active: number;
  } {
    return {
      total: this.unconditionalSkills.size + this.conditionalSkills.size,
      unconditional: this.unconditionalSkills.size,
      conditional: this.conditionalSkills.size,
      active: this.unconditionalSkills.size + this.activation.activeSkills.size,
    };
  }

  /**
   * Get the last file path checked for activation
   *
   * Useful for debugging and testing.
   *
   * @returns Last checked file path or undefined if none checked yet
   */
  getLastCheckedPath(): string | undefined {
    return this.lastCheckedPath;
  }

  /**
   * Set the last checked path
   * @internal For testing purposes
   */
  private lastCheckedPath?: string;

  /**
   * Reset all activation state (for testing)
   *
   * Clears active skills set but retains registered skills.
   * Useful between test cases or for resetting session state.
   *
   * @internal Primarily for testing
   */
  resetActivation(): void {
    this.activation.activeSkills.clear();
    this.lastCheckedPath = undefined;
  }

  /**
   * Get number of currently active conditional skills
   * (not counting unconditional skills)
   *
   * @returns Number of conditional skills that are active
   */
  getActiveConditionalCount(): number {
    return this.activation.activeSkills.size;
  }

  /**
   * Check if file would activate any skills
   *
   * Non-destructive check - doesn't actually activate anything.
   * Useful for preview/planning purposes.
   *
   * @param filePath - File path to check
   * @returns Array of skill names that would activate for this file
   */
  queryActivation(filePath: string): string[] {
    const matches: string[] = [];

    for (const [skillName, skill] of this.conditionalSkills) {
      if (skill.paths && matchesPattern(filePath, skill.paths)) {
        matches.push(skillName);
      }
    }

    return matches;
  }
}

/**
 * Global singleton registry for conditional skills
 */
let globalConditionalRegistry: ConditionalSkillRegistry | null = null;

/**
 * Get or create the global conditional skills registry singleton
 *
 * @returns Singleton ConditionalSkillRegistry instance
 */
export function getGlobalConditionalSkillRegistry(): ConditionalSkillRegistry {
  if (!globalConditionalRegistry) {
    globalConditionalRegistry = new ConditionalSkillRegistry();
  }
  return globalConditionalRegistry;
}

/**
 * Reset the global conditional registry to factory state
 *
 * @internal Primarily for testing
 */
export function resetGlobalConditionalRegistry(): void {
  if (globalConditionalRegistry) {
    globalConditionalRegistry.resetActivation();
  }
}
