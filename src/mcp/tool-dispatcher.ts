import type { ToolUseBlock, ToolResult } from "./protocol.ts";
import { ToolRegistry } from "./tool-registry.ts";
import { McpClientPool } from "./client.ts";
import type { BrowserLifecycleManager } from "../browser/lifecycle.ts";
import { getFeatureLogger } from "../logging/index.ts";
import { executeBuiltinTool } from "./builtin-tools.ts";

/**
 * Max consecutive identical tool calls before injecting a warning.
 * Prevents infinite loops when the model blindly retries the same action.
 */
const MAX_CONSECUTIVE_IDENTICAL_CALLS = 4;

export class ToolDispatcher {
  private readonly log = getFeatureLogger("ToolDispatcher");

  /** Track recent tool calls to detect repetitive loops. */
  private recentCalls: { name: string; argsKey: string }[] = [];

  constructor(
    private toolRegistry: ToolRegistry,
    private clientPool: McpClientPool,
    private browserLifecycle?: BrowserLifecycleManager,
  ) {}

  /**
   * Dispatch a single tool call to appropriate MCP server
   */

  async dispatchToolCall(toolUse: ToolUseBlock): Promise<ToolResult> {
    // ── Consecutive-duplicate-call guard ──────────────────────────────────
    const argsKey = JSON.stringify(toolUse.input);
    this.recentCalls.push({ name: toolUse.name, argsKey });
    // Keep a sliding window
    if (this.recentCalls.length > MAX_CONSECUTIVE_IDENTICAL_CALLS + 2) {
      this.recentCalls = this.recentCalls.slice(
        -MAX_CONSECUTIVE_IDENTICAL_CALLS - 2,
      );
    }
    // Check if the last N calls are identical
    const tail = this.recentCalls.slice(-MAX_CONSECUTIVE_IDENTICAL_CALLS);
    if (
      tail.length >= MAX_CONSECUTIVE_IDENTICAL_CALLS &&
      tail.every((c) => c.name === toolUse.name && c.argsKey === argsKey)
    ) {
      this.log.warn(
        `Repetitive tool call detected: '${toolUse.name}' called ${MAX_CONSECUTIVE_IDENTICAL_CALLS}+ times with identical args`,
      );
      // Reset so the model gets one warning per burst
      this.recentCalls = [];
      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content:
          `Warning: You have called '${toolUse.name}' ${MAX_CONSECUTIVE_IDENTICAL_CALLS} times in a row with the same arguments and the page has not changed. ` +
          `Stop repeating this action. Instead:\n` +
          `- Take a screenshot (browser_take_screenshot) to verify the current page state.\n` +
          `- Check scroll position with browser_evaluate: "return document.documentElement.scrollTop"\n` +
          `- If scrolling is not working, try browser_press_key with key="PageDown" instead of browser_mouse_wheel.\n` +
          `- If nothing works, report the issue to the user rather than looping.`,
        is_error: true,
      };
    }

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

    // ── Sanitize browser_mouse_wheel: move mouse to center of viewport first.
    // Many sites (LinkedIn, etc.) have fixed navbars at (0,0). If the mouse is
    // still at the default position, the wheel event hits the navbar (non-
    // scrollable), so the page never scrolls. Moving to center first ensures
    // the event targets the main content area.
    if (toolUse.name === "browser_mouse_wheel") {
      try {
        await client.callTool("browser_mouse_move_xy", { x: 640, y: 400 });
      } catch {
        // Best-effort; don't fail the wheel call if move fails
      }

      // Auto-fix: ensure deltaY/deltaX have sensible signs. If the model
      // sends negative deltaY for a "scroll down" action, flip it. This
      // catches cases where the model gets confused about scroll direction.
      const input = toolUse.input as Record<string, unknown>;
      const deltaY = typeof input["deltaY"] === "number" ? input["deltaY"] : 0;
      const deltaX = typeof input["deltaX"] === "number" ? input["deltaX"] : 0;

      // For down scrolls (the common case), deltaY should be positive.
      // If both are negative, the user likely meant positive (scroll down/right).
      if (deltaY < 0 && deltaX <= 0) {
        this.log.warn(
          "browser_mouse_wheel: negative deltaY detected, flipping to positive (scroll down)",
          { original: { deltaY, deltaX } },
        );
        toolUse = {
          ...toolUse,
          input: { ...input, deltaY: -deltaY, deltaX: -deltaX },
        };
      }
    }

    // Sanitize browser_evaluate input: ensure the `function` param is a proper
    // arrow function expression. Playwright checks `includes("=>")` on the raw
    // string — if the body itself contains inner arrow functions (e.g. forEach
    // callbacks), the check fires on those and the outer statement-body is never
    // wrapped, causing "Passed function is not well-serializable!".
    if (toolUse.name === "browser_evaluate") {
      const input = toolUse.input as Record<string, unknown>;
      if (typeof input["function"] === "string") {
        const fn = (input["function"] as string).trim();
        const isProperArrow =
          /^\(\s*\w*\s*\)\s*=>/.test(fn) || /^\w+\s*=>/.test(fn);
        if (!isProperArrow) {
          const wrapped = `() => { ${fn} }`;
          this.log.info(
            "browser_evaluate: wrapped bare function body into arrow function",
            {
              original: fn.slice(0, 120),
            },
          );
          toolUse = { ...toolUse, input: { ...input, function: wrapped } };
        }
      }
    }

    // Sanitize browser_run_code input: requires `async (page) => { }` wrapper.
    // Models often pass a raw statement body which causes SyntaxError.
    if (toolUse.name === "browser_run_code") {
      const input = toolUse.input as Record<string, unknown>;
      if (typeof input["code"] === "string") {
        const code = (input["code"] as string).trim();
        const isProperFn = /^async\s*\(/.test(code) || /^\(page\)/.test(code);
        if (!isProperFn) {
          const wrapped = `async (page) => { ${code} }`;
          this.log.info(
            "browser_run_code: wrapped bare code body into async (page) => { }",
            {
              original: code.slice(0, 120),
            },
          );
          toolUse = { ...toolUse, input: { ...input, code: wrapped } };
        }
      }
    }

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
      this.log.error(
        `Tool '${toolUse.name}' failed`,
        error instanceof Error ? error : new Error(errorMsg),
        { id: toolUse.id, input: JSON.stringify(toolUse.input).slice(0, 300) },
      );
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
