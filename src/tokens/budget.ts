/**
 * Token budget tracking and management
 * Allows soft warnings without hard limits
 */

/**
 * Token usage entry
 */
export interface TokenUsageEntry {
  phase: "system" | "prompt" | "tools" | "response" | "other";
  description: string;
  tokens: number;
  timestamp: number;
}

/**
 * Budget thresholds for warnings
 */
export interface BudgetThresholds {
  warning: number; // Warn at this percentage (e.g., 70)
  critical: number; // Warn again at this percentage (e.g., 90)
}

/**
 * Token budget tracker
 */
export class TokenBudgetTracker {
  private entries: TokenUsageEntry[] = [];
  private totalBudget: number;
  private thresholds: BudgetThresholds;
  private warningShown = false;
  private criticalWarningShown = false;

  constructor(
    totalBudget: number = 4096,
    thresholds?: Partial<BudgetThresholds>,
  ) {
    this.totalBudget = totalBudget;
    this.thresholds = {
      warning: thresholds?.warning ?? 70,
      critical: thresholds?.critical ?? 90,
    };
  }

  /**
   * Add tokens to budget
   */
  addTokens(
    phase: TokenUsageEntry["phase"],
    description: string,
    tokens: number,
  ): void {
    this.entries.push({
      phase,
      description,
      tokens,
      timestamp: Date.now(),
    });
  }

  /**
   * Get total tokens used
   */
  getTotalTokens(): number {
    return this.entries.reduce((sum, entry) => sum + entry.tokens, 0);
  }

  /**
   * Get remaining tokens
   */
  getRemainingTokens(): number {
    return Math.max(0, this.totalBudget - this.getTotalTokens());
  }

  /**
   * Get usage percentage
   */
  getUsagePercentage(): number {
    if (this.totalBudget === 0) return 0;
    return Math.round((this.getTotalTokens() / this.totalBudget) * 100);
  }

  /**
   * Check if warning threshold reached
   */
  isWarningThreshold(): boolean {
    return (
      this.getUsagePercentage() >= this.thresholds.warning && !this.warningShown
    );
  }

  /**
   * Check if critical threshold reached
   */
  isCriticalThreshold(): boolean {
    return this.getUsagePercentage() >= this.thresholds.critical;
  }

  /**
   * Mark warning as shown to avoid repeated warnings
   */
  markWarningShown(): void {
    this.warningShown = true;
  }

  /**
   * Mark critical warning as shown
   */
  markCriticalWarningShown(): void {
    this.criticalWarningShown = true;
  }

  /**
   * Get should show critical warning (every time threshold crossed)
   */
  shouldShowCriticalWarning(): boolean {
    return this.isCriticalThreshold() && !this.criticalWarningShown;
  }

  /**
   * Get breakdown by phase
   */
  getBreakdownByPhase(): Record<string, { count: number; tokens: number }> {
    const breakdown: Record<string, { count: number; tokens: number }> = {};

    for (const entry of this.entries) {
      if (!breakdown[entry.phase]) {
        breakdown[entry.phase] = { count: 0, tokens: 0 };
      }
      breakdown[entry.phase]!.count += 1;
      breakdown[entry.phase]!.tokens += entry.tokens;
    }

    return breakdown;
  }

  /**
   * Get recent entries
   */
  getRecentEntries(limit: number = 10): TokenUsageEntry[] {
    return this.entries.slice(-limit);
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.entries = [];
    this.warningShown = false;
    this.criticalWarningShown = false;
  }

  /**
   * Get full usage summary
   */
  getSummary(): {
    used: number;
    budget: number;
    remaining: number;
    percentage: number;
    entries: TokenUsageEntry[];
    breakdown: Record<string, { count: number; tokens: number }>;
  } {
    return {
      used: this.getTotalTokens(),
      budget: this.totalBudget,
      remaining: this.getRemainingTokens(),
      percentage: this.getUsagePercentage(),
      entries: this.entries,
      breakdown: this.getBreakdownByPhase(),
    };
  }
}

/**
 * Global token budget instance
 */
let globalBudget: TokenBudgetTracker | null = null;

/**
 * Get or create global budget tracker
 */
export function getGlobalTokenBudget(
  totalBudget: number = 4096,
): TokenBudgetTracker {
  if (!globalBudget) {
    globalBudget = new TokenBudgetTracker(totalBudget);
  }
  return globalBudget;
}

/**
 * Reset global budget
 */
export function resetGlobalTokenBudget(): void {
  globalBudget = null;
}
