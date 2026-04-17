/**
 * Logging module exports
 */

export { logger, Logger, FeatureLogger, getFeatureLogger } from "./logger.ts";
export type { LogLevel, LogEntry, LoggerConfig } from "./logger.ts";
export {
  readLogFile,
  getLogStats,
  searchLogs,
  getErrors,
  getLogsDir,
  getLogFilePaths,
  clearLogFile,
  getLogsSummary,
} from "./logUtils.ts";
export type { LogStats } from "./logUtils.ts";
export { logAuditEntry, readAuditLog, getAuditStats } from "./auditLog.ts";
export type { AuditEntry } from "./auditLog.ts";
export {
  logLLMRequest,
  logLLMResponse,
  initLLMRequestLogger,
} from "./llmRequestLogger.ts";
export type { LLMRequestDetails } from "./llmRequestLogger.ts";
