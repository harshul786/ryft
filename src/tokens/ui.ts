import chalk from "chalk";
import type { TokenBudgetTracker } from "./budget.ts";
import { formatTokenCount } from "./counter.ts";

/**
 * UI for token budget warnings and breakdown
 */

/**
 * Format warning message for threshold reached
 */
export function formatTokenWarning(tracker: TokenBudgetTracker): string | null {
  const percentage = tracker.getUsagePercentage();

  if (!tracker.isWarningThreshold() && !tracker.shouldShowCriticalWarning()) {
    return null;
  }

  const used = tracker.getTotalTokens();
  const budget = tracker.getSummary().budget;
  const remaining = tracker.getRemainingTokens();

  const isCritical = tracker.isCriticalThreshold();
  const prefix = isCritical
    ? chalk.red("⚠️  CRITICAL")
    : chalk.yellow("⚠️  WARNING");

  const lines = [
    prefix + ` Token Budget: ${percentage}% used`,
    chalk.dim(
      `  Used: ${formatTokenCount(used)} / ${formatTokenCount(budget)} tokens`,
    ),
    chalk.dim(`  Remaining: ${formatTokenCount(remaining)} tokens`),
  ];

  if (isCritical) {
    lines.push(
      chalk.red("  ⚠️  Approaching token limit - responses may be shortened"),
    );
  }

  return lines.join("\n");
}

/**
 * Format detailed token breakdown
 */
export function formatTokenBreakdown(tracker: TokenBudgetTracker): string {
  const summary = tracker.getSummary();
  const breakdown = summary.breakdown;

  const lines = [
    chalk.bold("Token Budget Breakdown:"),
    chalk.dim(
      `  Total: ${formatTokenCount(summary.used)} / ${formatTokenCount(summary.budget)} (${summary.percentage}%)`,
    ),
    "",
  ];

  // Sort by tokens (descending)
  const sorted = Object.entries(breakdown).sort(
    (a, b) => b[1]!.tokens - a[1]!.tokens,
  );

  for (const [phase, data] of sorted) {
    const bar = createProgressBar(data.tokens, summary.budget, 20);
    lines.push(
      chalk.cyan(`  ${phase.padEnd(10)}`),
      `    ${formatTokenCount(data.tokens).padStart(6)} tokens (${data.count} entries) ${bar}`,
    );
  }

  lines.push("");
  lines.push(chalk.dim(`  Remaining: ${formatTokenCount(summary.remaining)}`));

  return lines.join("\n");
}

/**
 * Create a visual progress bar
 */
function createProgressBar(
  current: number,
  total: number,
  width: number,
): string {
  if (total === 0) {
    return "";
  }

  const percentage = Math.min(100, Math.round((current / total) * 100));
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;

  const bar = "█".repeat(filled) + "░".repeat(empty);
  const color =
    percentage < 70 ? chalk.green : percentage < 90 ? chalk.yellow : chalk.red;

  return color(`[${bar}] ${percentage}%`);
}

/**
 * Format token info for REPL display
 */
export function formatTokenInfo(
  tracker: TokenBudgetTracker,
  showDetailed = false,
): string {
  const percentage = tracker.getUsagePercentage();
  const indicator =
    percentage < 50
      ? "🟢"
      : percentage < 75
        ? "🟡"
        : percentage < 90
          ? "🟠"
          : "🔴";

  let output = `${indicator} Tokens: ${formatTokenCount(tracker.getTotalTokens())} / ${formatTokenCount(tracker.getSummary().budget)}`;

  if (showDetailed) {
    output += "\n" + formatTokenBreakdown(tracker);
  }

  return output;
}

/**
 * Format token header for command output
 */
export function formatTokenHeader(tracker: TokenBudgetTracker): string {
  const percentage = tracker.getUsagePercentage();
  const indicator =
    percentage < 50
      ? "🟢"
      : percentage < 75
        ? "🟡"
        : percentage < 90
          ? "🟠"
          : "🔴";

  const summary = tracker.getSummary();
  return chalk.dim(
    `${indicator} ${formatTokenCount(summary.used)}/${formatTokenCount(summary.budget)} (${summary.percentage}%)`,
  );
}

/**
 * Display soft warning with option to continue
 */
export function displayTokenWarning(tracker: TokenBudgetTracker): void {
  const warning = formatTokenWarning(tracker);

  if (warning) {
    console.log("\n" + warning + "\n");

    // Auto-mark warnings as shown to prevent spam
    if (tracker.isWarningThreshold()) {
      tracker.markWarningShown();
    }
    if (tracker.shouldShowCriticalWarning()) {
      tracker.markCriticalWarningShown();
    }
  }
}

/**
 * Format /tokens command output
 */
export function formatTokensCommandOutput(tracker: TokenBudgetTracker): string {
  const lines = [
    chalk.bold("=== Token Usage ==="),
    "",
    formatTokenInfo(tracker, true),
    "",
    chalk.dim("Use /tokens detailed to see recent entries"),
  ];

  return lines.join("\n");
}

/**
 * Format detailed tokens command with recent entries
 */
export function formatTokensDetailedOutput(
  tracker: TokenBudgetTracker,
): string {
  const summary = tracker.getSummary();
  const recent = summary.entries.slice(-20);

  const lines = [
    chalk.bold("=== Token Usage (Detailed) ==="),
    "",
    formatTokenInfo(tracker, true),
    "",
    chalk.bold("Recent Entries:"),
  ];

  for (const entry of recent) {
    const timeStr = new Date(entry.timestamp).toLocaleTimeString();
    lines.push(
      chalk.dim(`  ${timeStr}`),
      `    ${entry.phase.padEnd(10)} ${formatTokenCount(entry.tokens).padStart(6)} ${entry.description}`,
    );
  }

  return lines.join("\n");
}
