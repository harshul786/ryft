/**
 * Centralized Logging System for Ryft CLI
 * 
 * Features:
 * - Multiple log levels (debug, info, warn, error)
 * - File-based storage in ~/.ryft/logs/
 * - Toggle on/off via RYFT_LOGS_ENABLED environment variable
 * - Respects logLevel from config
 * - Automatic log rotation
 * - Structured logging with timestamps and context
 */

import { writeFileSync, mkdirSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { hostname } from "node:os";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  isoTime: string;
  level: LogLevel;
  feature?: string; // Feature name (e.g., "MCP", "Browser", "Skills")
  message: string;
  context?: Record<string, unknown>;
  error?: string;
  stackTrace?: string;
}

export interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  maxFileSize: number; // in bytes
  maxFiles: number;
  logsDir: string;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private config: LoggerConfig;
  private logsDir: string;
  private debugLogFile: string;
  private errorLogFile: string;
  private generalLogFile: string;

  constructor(config?: Partial<LoggerConfig>) {
    this.logsDir = config?.logsDir || join(homedir(), ".ryft", "logs");
    this.debugLogFile = join(this.logsDir, "debug.log");
    this.errorLogFile = join(this.logsDir, "error.log");
    this.generalLogFile = join(this.logsDir, "general.log");

    this.config = {
      enabled: this.isLoggingEnabled(),
      level: this.getLogLevel(),
      maxFileSize: config?.maxFileSize || 10 * 1024 * 1024, // 10MB default
      maxFiles: config?.maxFiles || 5,
      logsDir: this.logsDir,
    };

    this.ensureLogsDirectory();
  }

  /**
   * Check if logging is enabled via environment variable or config
   */
  private isLoggingEnabled(): boolean {
    const envEnabled = process.env.RYFT_LOGS_ENABLED;
    if (envEnabled !== undefined) {
      return envEnabled.toLowerCase() !== "false" && envEnabled !== "0";
    }
    // Default to enabled in development, disabled in production
    return process.env.NODE_ENV !== "production" || process.env.DEBUG === "true";
  }

  /**
   * Get log level from environment or config
   */
  private getLogLevel(): LogLevel {
    const envLevel = process.env.RYFT_LOG_LEVEL as LogLevel | undefined;
    if (envLevel && this.isValidLogLevel(envLevel)) {
      return envLevel;
    }
    return "info";
  }

  private isValidLogLevel(level: unknown): level is LogLevel {
    return ["debug", "info", "warn", "error"].includes(level as string);
  }

  /**
   * Ensure logs directory exists
   */
  private ensureLogsDirectory(): void {
    try {
      if (!existsSync(this.logsDir)) {
        mkdirSync(this.logsDir, { recursive: true });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "EEXIST") {
        console.error("[LOGGER] Failed to create logs directory:", error);
      }
    }
  }

  /**
   * Check if message should be logged based on level
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.level];
  }

  /**
   * Format log entry as JSON
   */
  private formatEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
    feature?: string,
  ): LogEntry {
    const now = new Date();
    const formattedMessage = feature ? `[${feature}]:: ${message}` : message;
    return {
      timestamp: now.toLocaleString(),
      isoTime: now.toISOString(),
      level,
      message: formattedMessage,
      ...(feature && { feature }),
      ...(context && { context }),
      ...(error && {
        error: error.message,
        stackTrace: error.stack,
      }),
    };
  }

  /**
   * Write log entry to appropriate file(s)
   */
  private writeLog(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
    feature?: string,
  ): void {
    if (!this.config.enabled) return;

    try {
      const entry = this.formatEntry(level, message, context, error, feature);
      const logLine = JSON.stringify(entry);

      // Write to general log
      this.appendToFile(this.generalLogFile, logLine);

      // Write level-specific logs
      if (level === "debug") {
        this.appendToFile(this.debugLogFile, logLine);
      } else if (level === "error") {
        this.appendToFile(this.errorLogFile, logLine);
      }

      // Check for rotation
      this.checkAndRotate();
    } catch (err) {
      // Fail silently to not crash the application
      if (process.env.DEBUG) {
        console.error("[LOGGER] Failed to write log:", err);
      }
    }
  }

  /**
   * Append a line to a log file
   */
  private appendToFile(filePath: string, content: string): void {
    try {
      appendFileSync(filePath, content + "\n", "utf-8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "EACCES") {
        console.error(
          `[LOGGER] Permission denied writing to ${filePath}`,
          error,
        );
      }
    }
  }

  /**
   * Check if log files need rotation based on size
   */
  private checkAndRotate(): void {
    // Simplified rotation check - in production, use a more sophisticated approach
    const files = [this.generalLogFile, this.debugLogFile, this.errorLogFile];

    files.forEach((filePath) => {
      try {
        const { statSync } = require("node:fs");
        const stats = statSync(filePath);
        if (stats.size > this.config.maxFileSize) {
          this.rotateFile(filePath);
        }
      } catch {
        // File doesn't exist yet, skip
      }
    });
  }

  /**
   * Rotate a log file by appending timestamp
   */
  private rotateFile(filePath: string): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const ext = filePath.endsWith(".log") ? ".log" : "";
      const basePath = filePath.replace(ext, "");
      const rotatedPath = `${basePath}-${timestamp}${ext}`;

      const { renameSync } = require("node:fs");
      renameSync(filePath, rotatedPath);
    } catch (error) {
      if (process.env.DEBUG) {
        console.debug("[LOGGER] Failed to rotate file:", error);
      }
    }
  }

  /**
   * Log at debug level
   */
  debug(message: string, context?: Record<string, unknown>, feature?: string): void;
  debug(feature: string, message: string, context?: Record<string, unknown>): void;
  debug(
    messageOrFeature: string,
    contextOrMessage?: Record<string, unknown> | string,
    featureOrContext?: string | Record<string, unknown>,
  ): void {
    let message: string;
    let context: Record<string, unknown> | undefined;
    let feature: string | undefined;

    // Overload resolution
    if (typeof contextOrMessage === "string") {
      // Second overload: debug(feature, message, context)
      feature = messageOrFeature;
      message = contextOrMessage;
      context = featureOrContext as Record<string, unknown> | undefined;
    } else {
      // First overload: debug(message, context, feature)
      message = messageOrFeature;
      context = contextOrMessage;
      feature = featureOrContext as string | undefined;
    }

    if (this.shouldLog("debug")) {
      this.writeLog("debug", message, context, undefined, feature);
    }
  }

  /**
   * Log at info level
   */
  info(message: string, context?: Record<string, unknown>, feature?: string): void;
  info(feature: string, message: string, context?: Record<string, unknown>): void;
  info(
    messageOrFeature: string,
    contextOrMessage?: Record<string, unknown> | string,
    featureOrContext?: string | Record<string, unknown>,
  ): void {
    let message: string;
    let context: Record<string, unknown> | undefined;
    let feature: string | undefined;

    if (typeof contextOrMessage === "string") {
      feature = messageOrFeature;
      message = contextOrMessage;
      context = featureOrContext as Record<string, unknown> | undefined;
    } else {
      message = messageOrFeature;
      context = contextOrMessage;
      feature = featureOrContext as string | undefined;
    }

    if (this.shouldLog("info")) {
      this.writeLog("info", message, context, undefined, feature);
    }
  }

  /**
   * Log at warn level
   */
  warn(message: string, context?: Record<string, unknown>, feature?: string): void;
  warn(feature: string, message: string, context?: Record<string, unknown>): void;
  warn(
    messageOrFeature: string,
    contextOrMessage?: Record<string, unknown> | string,
    featureOrContext?: string | Record<string, unknown>,
  ): void {
    let message: string;
    let context: Record<string, unknown> | undefined;
    let feature: string | undefined;

    if (typeof contextOrMessage === "string") {
      feature = messageOrFeature;
      message = contextOrMessage;
      context = featureOrContext as Record<string, unknown> | undefined;
    } else {
      message = messageOrFeature;
      context = contextOrMessage;
      feature = featureOrContext as string | undefined;
    }

    if (this.shouldLog("warn")) {
      this.writeLog("warn", message, context, undefined, feature);
    }
  }

  /**
   * Log at error level
   */
  error(message: string, error?: Error, context?: Record<string, unknown>, feature?: string): void;
  error(feature: string, message: string, error?: Error, context?: Record<string, unknown>): void;
  error(
    messageOrFeature: string,
    errorOrMessage?: Error | string,
    contextOrError?: Record<string, unknown> | Error,
    featureOrContext?: string | Record<string, unknown>,
  ): void {
    let message: string;
    let error: Error | undefined;
    let context: Record<string, unknown> | undefined;
    let feature: string | undefined;

    if (typeof errorOrMessage === "string") {
      // Second overload: error(feature, message, error, context)
      feature = messageOrFeature;
      message = errorOrMessage;
      error = contextOrError instanceof Error ? contextOrError : undefined;
      context = featureOrContext as Record<string, unknown> | undefined;
    } else {
      // First overload: error(message, error, context, feature)
      message = messageOrFeature;
      error = errorOrMessage;
      context = contextOrError as Record<string, unknown> | undefined;
      feature = featureOrContext as string | undefined;
    }

    if (this.shouldLog("error")) {
      this.writeLog("error", message, context, error, feature);
    }
  }

  /**
   * Update logger configuration at runtime
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    if (config.logsDir) {
      this.logsDir = config.logsDir;
      this.ensureLogsDirectory();
    }
  }

  /**
   * Get current logger configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Get the path to logs directory
   */
  getLogsDir(): string {
    return this.logsDir;
  }

  /**
   * Disable logging
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Enable logging
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Check if logging is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    if (this.isValidLogLevel(level)) {
      this.config.level = level;
    }
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Create a feature-specific logger that automatically includes the feature name
   */
  getFeatureLogger(feature: string): FeatureLogger {
    return new FeatureLogger(this, feature);
  }
}

/**
 * Feature-specific logger wrapper that automatically includes feature name
 */
export class FeatureLogger {
  constructor(private baseLogger: Logger, readonly feature: string) {}

  debug(message: string, context?: Record<string, unknown>): void {
    this.baseLogger.debug(message, context, this.feature);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.baseLogger.info(message, context, this.feature);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.baseLogger.warn(message, context, this.feature);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.baseLogger.error(message, error, context, this.feature);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for testing
export { Logger };

/**
 * Convenience function to get a feature-specific logger
 * Usage: const mcp = getFeatureLogger("MCP");
 */
export function getFeatureLogger(feature: string): FeatureLogger {
  return logger.getFeatureLogger(feature);
}
