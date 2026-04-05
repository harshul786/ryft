// TODO #21: Add tool calls to memory tracking
export interface ToolCallRecord {
  // Tool name that was called
  toolName: string;

  // Server that owns the tool
  serverId: string;

  // Tool arguments
  arguments: Record<string, unknown>;

  // Tool result
  result: unknown;

  // Whether the tool call succeeded
  success: boolean;

  // Error message if failed
  error?: string;

  // Timestamp
  timestamp: number;
}

/**
 * Extended memory state with tool call tracking
 */
export interface ExtendedMemoryState {
  // Conversation snapshot (existing)
  snapshot: string;

  // Tool calls made in this conversation
  toolCalls?: ToolCallRecord[];

  // Active modes during tool calls
  activeModes?: string[];

  // Active memory mode during tool calls
  memoryMode?: string;
}

/**
 * Get tool call summary for memory
 */
export function summarizeToolCalls(toolCalls: ToolCallRecord[]): string {
  if (toolCalls.length === 0) {
    return "";
  }

  const lines = ["## Tool Calls Made:", ""];

  for (const call of toolCalls) {
    const status = call.success ? "✓" : "✗";
    lines.push(`${status} ${call.toolName} (from ${call.serverId})`);

    if (call.error) {
      lines.push(`  Error: ${call.error}`);
    } else if (call.result) {
      const resultStr =
        typeof call.result === "string"
          ? call.result
          : JSON.stringify(call.result);
      lines.push(`  Result: ${resultStr.substring(0, 100)}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Record a tool call in memory
 */
export function recordToolCall(
  toolCalls: ToolCallRecord[],
  toolName: string,
  serverId: string,
  args: Record<string, unknown>,
  result: unknown,
  error?: string,
): ToolCallRecord[] {
  const record: ToolCallRecord = {
    toolName,
    serverId,
    arguments: args,
    result,
    success: !error,
    error,
    timestamp: Date.now(),
  };

  return [...toolCalls, record];
}
