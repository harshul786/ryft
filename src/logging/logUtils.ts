/**
 * Utilities for reading and analyzing logs
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface LogStats {
  totalEntries: number;
  byLevel: Record<string, number>;
  timeRange: {
    earliest: string;
    latest: string;
  } | null;
  errorCount: number;
  warnCount: number;
}

/**
 * Read a log file and parse JSON entries
 */
export function readLogFile(filePath: string): Record<string, unknown>[] {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    return content
      .split("\n")
      .filter((line: string) => line.trim())
      .map((line: string) => {
        try {
          return JSON.parse(line);
        } catch {
          return { message: line, unparsed: true };
        }
      });
  } catch (error) {
    if (process.env.DEBUG) {
      console.debug("[LOG_UTILS] Failed to read log file:", error);
    }
    return [];
  }
}

/**
 * Get statistics about a log file
 */
export function getLogStats(filePath: string): LogStats {
  const entries = readLogFile(filePath);

  if (entries.length === 0) {
    return {
      totalEntries: 0,
      byLevel: {},
      timeRange: null,
      errorCount: 0,
      warnCount: 0,
    };
  }

  const byLevel: Record<string, number> = {};
  let errorCount = 0;
  let warnCount = 0;

  entries.forEach((entry: Record<string, unknown>) => {
    const level = entry.level as string;
    if (level) {
      byLevel[level] = (byLevel[level] || 0) + 1;
      if (level === "error") errorCount++;
      if (level === "warn") warnCount++;
    }
  });

  const timeRange = {
    earliest: entries[0]?.isoTime as string,
    latest: entries[entries.length - 1]?.isoTime as string,
  };

  return {
    totalEntries: entries.length,
    byLevel,
    timeRange: timeRange.earliest ? timeRange : null,
    errorCount,
    warnCount,
  };
}

/**
 * Search logs by pattern
 */
export function searchLogs(
  filePath: string,
  pattern: string | RegExp,
): Record<string, unknown>[] {
  const entries = readLogFile(filePath);
  const regex =
    typeof pattern === "string"
      ? new RegExp(pattern, "i")
      : pattern;

  return entries.filter((entry: Record<string, unknown>) => {
    const message = entry.message as string;
    return message && regex.test(message);
  });
}

/**
 * Get errors from error log
 */
export function getErrors(limit?: number): Record<string, unknown>[] {
  const errorLogPath = join(homedir(), ".ryft", "logs", "error.log");
  const entries = readLogFile(errorLogPath);
  return limit ? entries.slice(-limit) : entries;
}

/**
 * Get all logs directory path
 */
export function getLogsDir(): string {
  return join(homedir(), ".ryft", "logs");
}

/**
 * Get all log file paths
 */
export function getLogFilePaths(): {
  general: string;
  debug: string;
  error: string;
} {
  const logsDir = getLogsDir();
  return {
    general: join(logsDir, "general.log"),
    debug: join(logsDir, "debug.log"),
    error: join(logsDir, "error.log"),
  };
}

/**
 * Clear a log file
 */
export function clearLogFile(filePath: string): boolean {
  try {
    const { writeFileSync } = require("node:fs");
    writeFileSync(filePath, "", "utf-8");
    return true;
  } catch (error) {
    if (process.env.DEBUG) {
      console.debug("[LOG_UTILS] Failed to clear log file:", error);
    }
    return false;
  }
}

/**
 * Get summary of all logs
 */
export function getLogsSummary(): {
  general: LogStats;
  debug: LogStats;
  error: LogStats;
} {
  const paths = getLogFilePaths();
  return {
    general: getLogStats(paths.general),
    debug: getLogStats(paths.debug),
    error: getLogStats(paths.error),
  };
}
