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
   * Handles OpenAI format tool_use blocks
   */
  extractToolUsesFromResponse(responseText: string): ToolUseBlock[] {
    // Look for tool use patterns in response
    // This is a simplified extraction - real implementation would parse structured format
    const toolUses: ToolUseBlock[] = [];

    // Pattern: <tool_use id="..." name="..." input="{...}"></tool_use>
    const pattern =
      /<tool_use\s+id="([^"]+)"\s+name="([^"]+)"\s+input='([^']+)'>/g;
    let match;

    while ((match = pattern.exec(responseText)) !== null) {
      try {
        const input = JSON.parse(match[3]);
        toolUses.push({
          type: "tool_use",
          id: match[1],
          name: match[2],
          input,
        });
      } catch (error) {
        console.warn(`Failed to parse tool use input: ${error}`);
      }
    }

    return toolUses;
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
