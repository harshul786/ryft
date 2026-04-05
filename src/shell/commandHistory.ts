/**
 * Command history persistence
 * Stores executed commands to ~/.ryft/command-history.json for replay/search
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface HistoryEntry {
  timestamp: number;
  command: string;
  args: string[];
  exitCode?: number;
  stderr?: string;
}

const HISTORY_DIR = join(homedir(), ".ryft");
const HISTORY_FILE = join(HISTORY_DIR, "command-history.json");
const MAX_HISTORY_ENTRIES = 1000;

let historyCache: HistoryEntry[] | null = null;

/**
 * Load history from disk (with cache)
 */
export function loadHistory(): HistoryEntry[] {
  if (historyCache !== null) {
    return historyCache;
  }

  try {
    const content = readFileSync(HISTORY_FILE, "utf-8");
    historyCache = JSON.parse(content);
    return historyCache;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      // File doesn't exist yet
      historyCache = [];
      return historyCache;
    }
    if (process.env.DEBUG) {
      console.debug("[HISTORY] Failed to load history:", error);
    }
    return [];
  }
}

/**
 * Save entry to history
 */
export function addHistoryEntry(
  command: string,
  args: string[],
  exitCode?: number,
  stderr?: string,
): void {
  try {
    const history = loadHistory();

    const entry: HistoryEntry = {
      timestamp: Date.now(),
      command,
      args,
      ...(exitCode !== undefined && { exitCode }),
      ...(stderr && { stderr }),
    };

    history.push(entry);

    // Keep only last N entries
    if (history.length > MAX_HISTORY_ENTRIES) {
      history.splice(0, history.length - MAX_HISTORY_ENTRIES);
    }

    // Ensure directory exists
    try {
      mkdirSync(HISTORY_DIR, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "EEXIST") {
        throw error;
      }
    }

    // Write to disk
    writeFileSync(
      HISTORY_FILE,
      JSON.stringify(history, null, 2) + "\n",
      "utf-8",
    );

    // Update cache
    historyCache = history;

    if (process.env.DEBUG) {
      console.debug(
        `[HISTORY] Added entry: ${command} (${history.length} total)`,
      );
    }
  } catch (error) {
    if (process.env.DEBUG) {
      console.debug("[HISTORY] Failed to save entry:", error);
    }
  }
}

/**
 * Search history by command name or pattern
 */
export function searchHistory(pattern: string): HistoryEntry[] {
  const history = loadHistory();
  const regex = new RegExp(pattern, "i");

  return history.filter(
    (entry) =>
      regex.test(entry.command) || entry.args.some((arg) => regex.test(arg)),
  );
}

/**
 * Get last N commands
 */
export function getRecentCommands(count: number = 10): HistoryEntry[] {
  const history = loadHistory();
  return history.slice(-count).reverse();
}

/**
 * Get command frequency (for analytics/suggestions)
 */
export function getCommandFrequency(): Map<string, number> {
  const history = loadHistory();
  const frequency = new Map<string, number>();

  for (const entry of history) {
    const current = frequency.get(entry.command) || 0;
    frequency.set(entry.command, current + 1);
  }

  return frequency;
}

/**
 * Clear history (use with caution)
 */
export function clearHistory(): void {
  try {
    writeFileSync(HISTORY_FILE, "[]", "utf-8");
    historyCache = [];
    if (process.env.DEBUG) {
      console.debug("[HISTORY] Cleared all history");
    }
  } catch (error) {
    if (process.env.DEBUG) {
      console.debug("[HISTORY] Failed to clear history:", error);
    }
  }
}

/**
 * Export history as JSON (for backup/sharing)
 */
export function exportHistory(): string {
  const history = loadHistory();
  return JSON.stringify(history, null, 2);
}

/**
 * Get history statistics
 */
export function getHistoryStats(): {
  totalEntries: number;
  uniqueCommands: number;
  firstCommand: HistoryEntry | null;
  lastCommand: HistoryEntry | null;
  averagePerDay: number;
} {
  const history = loadHistory();
  const uniqueCommands = new Set(history.map((e) => e.command)).size;

  if (history.length === 0) {
    return {
      totalEntries: 0,
      uniqueCommands: 0,
      firstCommand: null,
      lastCommand: null,
      averagePerDay: 0,
    };
  }

  const firstTimestamp = history[0].timestamp;
  const lastTimestamp = history[history.length - 1].timestamp;
  const daysDiff =
    (lastTimestamp - firstTimestamp) / (1000 * 60 * 60 * 24) || 1;
  const averagePerDay = history.length / daysDiff;

  return {
    totalEntries: history.length,
    uniqueCommands,
    firstCommand: history[0],
    lastCommand: history[history.length - 1],
    averagePerDay,
  };
}
