import type { ToolUseBlock, ToolResult } from "./protocol.ts";
import { ToolRegistry } from "./tool-registry.ts";
import { McpClientPool } from "./client.ts";
import type { BrowserLifecycleManager } from "../browser/lifecycle.ts";
import { getFeatureLogger } from "../logging/index.ts";

export class ToolDispatcher {
  private readonly log = getFeatureLogger("ToolDispatcher");

  constructor(
    private toolRegistry: ToolRegistry,
    private clientPool: McpClientPool,
    private browserLifecycle?: BrowserLifecycleManager,
  ) {}

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

      let resultText: string;
      if (typeof result === "string") {
        resultText = result;
      } else if (result && typeof result === "object") {
        resultText = JSON.stringify(result, null, 2);
      } else {
        resultText = String(result);
      }

      this.log.info(`Tool '${toolUse.name}' succeeded`, {
        id: toolUse.id,
        byteLen: resultText.length,
      });

      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: resultText,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log.warn(`Tool '${toolUse.name}' failed`, {
        id: toolUse.id,
        error: errorMsg,
      });
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
}
