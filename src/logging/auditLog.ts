/**
 * Audit logging for Ryft
 * Logs command execution with security/compliance context
 */

import { writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface AuditEntry {
  timestamp: string;
  isoTime: string;
  command: string;
  args: string[];
  user: string;
  exitCode: number;
  duration: number;
  error?: string;
  source: "repl" | "cli" | "api";
}

const AUDIT_DIR = join(homedir(), ".ryft");
const AUDIT_FILE = join(AUDIT_DIR, "audit.jsonl");

/**
 * Log a command execution for audit purposes
 */
export function logAuditEntry(
  command: string,
  args: string[],
  exitCode: number,
  duration: number,
  source: "repl" | "cli" | "api" = "cli",
  error?: string,
): void {
  try {
    const now = new Date();
    const user = process.env.USER || "unknown";

    const entry: AuditEntry = {
      timestamp: now.toLocaleString(),
      isoTime: now.toISOString(),
      command,
      args,
      user,
      exitCode,
      duration,
      source,
      ...(error && { error }),
    };

    // Ensure directory exists
    try {
      mkdirSync(AUDIT_DIR, { recursive: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== "EEXIST") {
        throw err;
      }
    }

    // Append as JSONL (one JSON object per line)
    appendFileSync(AUDIT_FILE, JSON.stringify(entry) + "\n", "utf-8");

    if (process.env.DEBUG) {
      console.debug(
        `[AUDIT] Logged: ${command} (exit ${exitCode}, ${duration}ms)`,
      );
    }
  } catch (error) {
    if (process.env.DEBUG) {
      console.debug("[AUDIT] Failed to write audit log:", error);
    }
    // Don't throw - audit logging should not crash the app
  }
}

/**
 * Parse audit log file into entries
 */
export function readAuditLog(): AuditEntry[] {
  try {
    const content = require("node:fs").readFileSync(AUDIT_FILE, "utf-8");
    return content
      .split("\n")
      .filter((line: string) => line.trim())
      .map((line: string) => JSON.parse(line));
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return [];
    }
    if (process.env.DEBUG) {
      console.debug("[AUDIT] Failed to read audit log:", error);
    }
    return [];
  }
}

/**
 * Get audit entries for a specific time range
 */
export function getAuditEntriesByTimeRange(
  startTime: Date,
  endTime: Date,
): AuditEntry[] {
  const entries = readAuditLog();
  return entries.filter((entry) => {
    const entryTime = new Date(entry.isoTime);
    return entryTime >= startTime && entryTime <= endTime;
  });
}

/**
 * Get audit entries by command name
 */
export function getAuditEntriesByCommand(command: string): AuditEntry[] {
  const entries = readAuditLog();
  return entries.filter((entry) => entry.command === command);
}

/**
 * Get failed command executions for troubleshooting
 */
export function getFailedCommands(limit?: number): AuditEntry[] {
  const entries = readAuditLog();
  const failed = entries.filter((entry) => entry.exitCode !== 0);
  return limit ? failed.slice(-limit) : failed;
}

/**
 * Get audit statistics
 */
export function getAuditStats(startTime?: Date): {
  totalCommands: number;
  totalErrors: number;
  errorRate: number;
  mostUsedCommand: string | null;
  averageDuration: number;
  successRate: number;
} {
  let entries = readAuditLog();

  if (startTime) {
    entries = entries.filter((e) => new Date(e.isoTime) >= startTime);
  }

  if (entries.length === 0) {
    return {
      totalCommands: 0,
      totalErrors: 0,
      errorRate: 0,
      mostUsedCommand: null,
      averageDuration: 0,
      successRate: 0,
    };
  }

  const failed = entries.filter((e) => e.exitCode !== 0);
  const commandFreq = new Map<string, number>();

  for (const entry of entries) {
    const count = commandFreq.get(entry.command) || 0;
    commandFreq.set(entry.command, count + 1);
  }

  let mostUsedCommand: string | null = null;
  let maxCount = 0;
  for (const [cmd, count] of commandFreq.entries()) {
    if (count > maxCount) {
      maxCount = count;
      mostUsedCommand = cmd;
    }
  }

  const avgDuration =
    entries.reduce((sum, e) => sum + e.duration, 0) / entries.length;

  return {
    totalCommands: entries.length,
    totalErrors: failed.length,
    errorRate: failed.length / entries.length,
    mostUsedCommand,
    averageDuration: Math.round(avgDuration),
    successRate: (entries.length - failed.length) / entries.length,
  };
}

/**
 * Helper to create a decorated audit log for reporting
 */
export function generateAuditReport(title: string = "Audit Report"): string {
  const stats = getAuditStats();
  const entries = readAuditLog();

  let report = `\n${"=".repeat(60)}\n`;
  report += `${title}\n`;
  report += `${"=".repeat(60)}\n\n`;

  report += `Generated: ${new Date().toISOString()}\n\n`;

  report += `Statistics:\n`;
  report += `  Total Commands: ${stats.totalCommands}\n`;
  report += `  Success Rate: ${(stats.successRate * 100).toFixed(1)}%\n`;
  report += `  Total Errors: ${stats.totalErrors}\n`;
  report += `  Avg Duration: ${stats.averageDuration}ms\n`;
  report += `  Most Used: ${stats.mostUsedCommand || "(none)"}\n\n`;

  if (entries.length > 0) {
    report += `Recent Commands (last 10):\n`;
    for (const entry of entries.slice(-10).reverse()) {
      const status = entry.exitCode === 0 ? "✓" : "✗";
      report += `  ${status} ${entry.isoTime} ${entry.command} ${entry.args.join(" ")}\n`;
    }
  }

  report += `\n${"=".repeat(60)}\n`;

  return report;
}

/**
 * Sanitize sensitive data from audit logs (API keys, etc)
 */
export function getSanitizedEntry(entry: AuditEntry): AuditEntry {
  const sanitized = { ...entry };

  // Redact API keys and similar sensitive data from args
  sanitized.args = sanitized.args.map((arg) => {
    if (
      arg.includes("key=") ||
      arg.includes("token=") ||
      arg.includes("=sk-")
    ) {
      return "[REDACTED]";
    }
    return arg;
  });

  return sanitized;
}
