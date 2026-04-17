/**
 * LLM Request Logger — comprehensive logging for all API requests to LLMs
 *
 * Logs the complete request including:
 * - System prompts
 * - All messages (system, user, assistant, tool)
 * - Model configuration
 * - Available tools
 * - Request parameters
 *
 * Configuration via ~/.ryftrc or .ryft.json:
 * {
 *   "logLevel": "debug",
 *   "llmRequestLogging": {
 *     "enabled": true,
 *     "logRequests": true,
 *     "logResponses": true,
 *     "logSystemPrompt": true,
 *     "logMessages": true,
 *     "logTools": true,
 *     "truncateAt": 500
 *   }
 * }
 *
 * Usage: Call logLLMRequest() before making an API call
 */

import { logger, getFeatureLogger } from "./logger.ts";
import type { ChatMessage, ToolUseContentPart } from "../types.ts";
import type { ConfigFile } from "../config/types.ts";

export interface LLMRequestDetails {
  baseUrl: string;
  model: string;
  providerType: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }>;
  thinkingConfig?: {
    type: "disabled" | "enabled" | "adaptive";
    budgetTokens?: number;
  };
}

// Global config holder - will be set once at startup
let globalConfig: ConfigFile = {};

/**
 * Format a single message for logging
 */
function formatMessageForLog(
  msg: ChatMessage,
  truncateAt: number = 500,
): string {
  const role = msg.role.toUpperCase().padEnd(10);

  if (typeof msg.content === "string") {
    // Truncate long strings to avoid massive logs
    const contentStr =
      msg.content.length > truncateAt
        ? msg.content.substring(0, truncateAt) +
          `... [TRUNCATED: ${msg.content.length - truncateAt} chars]`
        : msg.content;
    return `${role}: ${contentStr}`;
  }

  // Structured content (tool calls, etc.)
  if (Array.isArray(msg.content)) {
    const parts: string[] = [];
    for (const part of msg.content) {
      if ((part as any).type === "text") {
        const text = (part as { type: "text"; text: string }).text;
        const truncated =
          text.length > truncateAt
            ? text.substring(0, truncateAt) +
              `... [TRUNCATED: ${text.length - truncateAt} chars]`
            : text;
        parts.push(`TEXT: ${truncated}`);
      } else if ((part as any).type === "tool_use") {
        const toolUse = part as ToolUseContentPart;
        parts.push(
          `TOOL_USE(${toolUse.name}): ${JSON.stringify(toolUse.input)}`,
        );
      } else if ((part as any).type === "tool_result") {
        const toolResult = part as any;
        parts.push(
          `TOOL_RESULT(${toolResult.tool_use_id}): ${toolResult.content}`,
        );
      }
    }
    return `${role}: [${parts.join(" | ")}]`;
  }

  return `${role}: [unknown content type]`;
}

/**
 * Initialize LLM request logger with config
 * Call this once at startup with the loaded config
 */
export function initLLMRequestLogger(config: ConfigFile): void {
  globalConfig = config;
}

/**
 * Get the current LLM request logging config
 */
function getLLMLoggingConfig() {
  return (
    globalConfig?.llmRequestLogging || {
      enabled: false,
      logRequests: true,
      logResponses: true,
      logSystemPrompt: true,
      logMessages: true,
      logTools: true,
      truncateAt: 500,
    }
  );
}
function formatToolsForLog(tools: LLMRequestDetails["tools"]): string {
  if (!tools || tools.length === 0) {
    return "No tools";
  }

  const toolList = tools
    .map((t) => {
      const name = t.function.name;
      const desc = t.function.description || "(no description)";
      return `- ${name}: ${desc.substring(0, 80)}${desc.length > 80 ? "..." : ""}`;
    })
    .join("\n");

  return `${tools.length} tool(s):\n${toolList}`;
}

/**
 * Log a complete LLM request with all details
 */
export function logLLMRequest(request: LLMRequestDetails): void {
  const config = getLLMLoggingConfig();

  // Return early if logging is disabled
  if (!config.enabled || !config.logRequests) {
    return;
  }

  const log = getFeatureLogger("LLMRequest");
  const truncateAt = config.truncateAt ?? 500;

  // Build the complete request log
  const separator = "═".repeat(80);
  const lines: string[] = [
    "",
    separator,
    "🔵 LLM REQUEST",
    separator,
    "",
    // Model info
    `📌 Model: ${request.model}`,
    `🌐 Provider: ${request.providerType}`,
    `🔗 Base URL: ${request.baseUrl}`,
    "",
    // Configuration
    `🌡️  Temperature: ${request.temperature ?? "1.0"}`,
    `📝 Max Tokens: ${request.maxTokens ?? "4096"}`,
    request.thinkingConfig
      ? `🧠 Thinking: ${request.thinkingConfig.type}${
          request.thinkingConfig.budgetTokens
            ? ` (${request.thinkingConfig.budgetTokens} tokens)`
            : ""
        }`
      : null,
    "",
  ];

  // Include messages section based on config
  if (config.logMessages) {
    lines.push(
      `📨 Messages (${request.messages.length} total):`,
      ...request.messages.map(
        (msg) => "  " + formatMessageForLog(msg, truncateAt),
      ),
      "",
    );
  }

  // Include tools section based on config
  if (config.logTools) {
    lines.push(
      "🛠️  Available Tools:",
      ...formatToolsForLog(request.tools)
        .split("\n")
        .map((line) => "  " + line),
      "",
    );
  }

  lines.push(separator);

  const fullMessage = lines.filter((line) => line !== null).join("\n");

  // Log to debug level so it respects RYFT_LOG_LEVEL
  log.debug("Complete LLM Request", {
    model: request.model,
    provider: request.providerType,
    messageCount: request.messages.length,
    toolCount: request.tools?.length ?? 0,
  });

  // Log the full formatted message
  log.debug(fullMessage);

  // Also log the raw request as structured data
  const structuredLog: Record<string, unknown> = {
    type: "llm_request",
    timestamp: new Date().toISOString(),
    model: request.model,
    provider: request.providerType,
    baseUrl: request.baseUrl,
    config: {
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      thinkingConfig: request.thinkingConfig,
    },
    toolsCount: request.tools?.length ?? 0,
  };

  if (config.logMessages) {
    structuredLog.messages = request.messages.map((msg) => ({
      role: msg.role,
      contentType: typeof msg.content === "string" ? "text" : "structured",
      contentLength:
        typeof msg.content === "string"
          ? msg.content.length
          : Array.isArray(msg.content)
            ? msg.content.length
            : 0,
    }));
  }

  log.debug("LLM Request (structured)", structuredLog);
}

/**
 * Log an LLM response/completion
 */
export function logLLMResponse(details: {
  model: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  responseText: string;
  toolCalls?: ToolUseContentPart[];
  duration?: number;
  error?: string;
}): void {
  const config = getLLMLoggingConfig();

  // Return early if logging is disabled
  if (!config.enabled || !config.logResponses) {
    return;
  }

  const log = getFeatureLogger("LLMRequest");
  const truncateAt = config.truncateAt ?? 500;

  const separator = "═".repeat(80);
  const lines: string[] = [
    "",
    separator,
    "✅ LLM RESPONSE",
    separator,
    "",
    `📌 Model: ${details.model}`,
    details.duration ? `⏱️  Duration: ${details.duration}ms` : null,
    "",
    `📝 Response Text (${details.responseText.length} chars):`,
    ...details.responseText
      .substring(0, truncateAt)
      .split("\n")
      .map((line) => "  " + line),
    details.responseText.length > truncateAt
      ? `  ... [TRUNCATED: ${details.responseText.length - truncateAt} more chars]`
      : null,
    "",
    details.toolCalls && details.toolCalls.length > 0
      ? `🔧 Tool Calls (${details.toolCalls.length}):` +
        details.toolCalls
          .map((tc) => `  - ${tc.name}: ${JSON.stringify(tc.input)}`)
          .join("\n")
      : null,
    "",
    details.usage
      ? `💾 Token Usage:
  - Input: ${details.usage.input_tokens ?? 0}
  - Output: ${details.usage.output_tokens ?? 0}
  - Total: ${details.usage.total_tokens ?? 0}`
      : null,
    details.error ? `❌ Error: ${details.error}` : null,
    "",
    separator,
  ].filter((line) => line !== null) as string[];

  const fullMessage = lines.join("\n");
  log.debug(fullMessage);

  // Structured logging
  const structuredLog: Record<string, unknown> = {
    type: "llm_response",
    timestamp: new Date().toISOString(),
    model: details.model,
    duration: details.duration,
    responseLength: details.responseText.length,
    toolCallsCount: details.toolCalls?.length ?? 0,
    usage: details.usage,
    hasError: !!details.error,
    error: details.error,
  };

  log.debug("LLM Response (structured)", structuredLog);
}
