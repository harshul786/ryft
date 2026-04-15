import type { ToolUseBlock, ToolResult } from "./protocol.ts";
import { ToolRegistry } from "./tool-registry.ts";
import { McpClientPool } from "./client.ts";
import type { BrowserLifecycleManager } from "../browser/lifecycle.ts";
import { getFeatureLogger } from "../logging/index.ts";
import { executeBuiltinTool } from "./builtin-tools.ts";

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
      this.log.warn(`Tool '${toolUse.name}' not found in registry`, {
        id: toolUse.id,
        availableTools: this.toolRegistry.getStats(),
      });
      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: `Error: Tool '${toolUse.name}' not found in registry. Are you in the correct mode? Active tools: ${this.toolRegistry.getStats().totalTools}`,
        is_error: true,
      };
    }

    if (matching.length > 1) {
      this.log.warn(`Tool '${toolUse.name}' is ambiguous`, {
        id: toolUse.id,
        servers: matching.map((m) => m.serverId),
      });
      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: `Error: Tool '${toolUse.name}' is ambiguous (found in ${matching.map((m) => m.serverId).join(", ")})`,
        is_error: true,
      };
    }

    const entry = matching[0]!;

    // Handle built-in tools
    if (entry.serverId === "builtin") {
      try {
        const result = await executeBuiltinTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
        );
        this.log.info(`Built-in tool '${toolUse.name}' succeeded`, {
          id: toolUse.id,
          preview: result.slice(0, 200) + (result.length > 200 ? "…" : ""),
        });
        return {
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.log.warn(`Built-in tool '${toolUse.name}' failed`, {
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
      let imageData: string | undefined;

      // MCP tools/call responses have shape { content: Array<{ type, text?, data?, mimeType? }> }
      type McpContentPart = {
        type: string;
        text?: string;
        data?: string;
        mimeType?: string;
      };
      if (
        result &&
        typeof result === "object" &&
        "content" in result &&
        Array.isArray((result as { content: unknown }).content)
      ) {
        const parts = (result as { content: McpContentPart[] }).content;
        const textParts = parts
          .filter((p) => p.type === "text")
          .map((p) => p.text ?? "")
          .join("\n");
        const imagePart = parts.find((p) => p.type === "image");
        if (imagePart?.data && imagePart?.mimeType) {
          imageData = `data:${imagePart.mimeType};base64,${imagePart.data}`;
        }
        resultText =
          textParts ||
          (imageData ? "Screenshot captured." : "Tool executed successfully.");
      } else if (typeof result === "string") {
        resultText = result;
      } else if (result && typeof result === "object") {
        resultText = JSON.stringify(result, null, 2);
      } else {
        resultText = String(result);
      }

      this.log.info(`Tool '${toolUse.name}' succeeded`, {
        id: toolUse.id,
        byteLen: resultText.length + (imageData?.length ?? 0),
        ...(imageData
          ? { image: `${imageData.slice(0, 40)}… (${imageData.length} bytes)` }
          : {
              preview:
                resultText.slice(0, 200) + (resultText.length > 200 ? "…" : ""),
            }),
      });

      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: resultText,
        ...(imageData && { imageData }),
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
