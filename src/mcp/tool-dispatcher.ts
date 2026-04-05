import type { ToolUseBlock, ToolResult } from "./protocol.ts";
import { ToolRegistry } from "./tool-registry.ts";
import { McpClientPool } from "./client.ts";
import type { BrowserLifecycleManager } from "../browser/lifecycle.ts";

// TODO #20: Implement tool call dispatch from LLM responses
export class ToolDispatcher {
  constructor(
    private toolRegistry: ToolRegistry,
    private clientPool: McpClientPool,
    private browserLifecycle?: BrowserLifecycleManager,
  ) {}

  /**
   * Extract tool use blocks from LLM response text
   * Handles multiple formats of tool_use blocks
   */
  extractToolUsesFromResponse(responseText: string): ToolUseBlock[] {
    const toolUses: ToolUseBlock[] = [];

    // Pattern 1: <tool_use id="..." name="..." input="{...}"></tool_use>
    // Pattern 2: <tool_use id="..." name="..." input='{...}' />
    // Matches both single and double quotes for input, and both closing formats
    const patterns = [
      /<tool_use\s+id="([^"]+)"\s+name="([^"]+)"\s+input='([^']*)'>/g,
      /<tool_use\s+id="([^"]+)"\s+name="([^"]+)"\s+input="([^"]*)"/g,
      /<tool_use\s+id="([^"]+)"\s+name="([^"]+)"\s+input='([^']*)'[^>]*\/>/g,
      /<tool_use\s+id="([^"]+)"\s+name="([^"]+)"\s+input="([^"]*)"[^>]*\/>/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(responseText)) !== null) {
        try {
          // Try to parse input - could be empty object or actual JSON
          let input = {};
          const inputStr = match[3]?.trim();
          if (inputStr && inputStr !== "{}") {
            try {
              input = JSON.parse(inputStr);
            } catch {
              // If not valid JSON, treat as empty object
              input = {};
            }
          }

          toolUses.push({
            type: "tool_use",
            id: match[1],
            name: match[2],
            input,
          });
        } catch (error) {
          console.warn(
            `Failed to parse tool use: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    // Remove duplicates by id
    const seen = new Set<string>();
    return toolUses.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }

  /**
   * Dispatch a single tool call to appropriate MCP server
   */
  async dispatchToolCall(toolUse: ToolUseBlock): Promise<ToolResult> {
    // Find tool in registry
    const matching = this.toolRegistry.getToolsByName(toolUse.name);

    if (matching.length === 0) {
      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: `Error: Tool '${toolUse.name}' not found`,
        is_error: true,
      };
    }

    if (matching.length > 1) {
      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: `Error: Tool '${toolUse.name}' is ambiguous (found in ${matching.map((m) => m.serverId).join(", ")})`,
        is_error: true,
      };
    }

    const entry = matching[0]!;

    // Handle on-demand browser initialization
    if (entry.serverId === "browser-surff" && this.browserLifecycle) {
      try {
        await this.browserLifecycle.ensureInitialized();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return {
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: `Error initializing browser: ${errorMsg}`,
          is_error: true,
        };
      }
    }

    // Get client for server
    const client = this.clientPool.getClient({
      id: entry.serverId,
      name: entry.serverName,
      description: entry.tool.description,
      command: "", // Not used here
    });

    // Call tool
    try {
      const result = await client.callTool(toolUse.name, toolUse.input);

      // Format result
      let resultText: string;
      if (typeof result === "string") {
        resultText = result;
      } else if (result && typeof result === "object") {
        resultText = JSON.stringify(result, null, 2);
      } else {
        resultText = String(result);
      }

      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: resultText,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: `Error calling tool '${toolUse.name}': ${errorMsg}`,
        is_error: true,
      };
    }
  }

  /**
   * Dispatch multiple tool calls and wait for results
   */
  async dispatchToolCalls(toolUses: ToolUseBlock[]): Promise<ToolResult[]> {
    return Promise.all(toolUses.map((use) => this.dispatchToolCall(use)));
  }

  /**
   * Process tool results for conversation continuation
   * Format tool results so LLM can continue
   */
  formatToolResultsForConversation(results: ToolResult[]): string {
    if (results.length === 0) {
      return "";
    }

    const lines: string[] = [];
    for (const result of results) {
      lines.push(`[Tool result: ${result.tool_use_id}]`);
      if (result.is_error) {
        lines.push(`Error: ${result.content}`);
      } else {
        lines.push(result.content);
      }
      lines.push("");
    }

    return lines.join("\n");
  }
}
