import type { McpClient } from "../mcp/client.ts";
import type { BrowserState } from "./mcp-server.ts";

/**
 * On-demand browser lifecycle manager
 * Manages browser server spawn state and coordinates with on-demand initialization
 * Works with already-spawned clients from the MCP pool
 */
export class BrowserLifecycleManager {
  private initialized = false;
  private previousState?: BrowserState;
  private serverInitialized = false;
  private client: McpClient | null = null;

  constructor(private serverId = "browser-surff") {}

  /**
   * Check if browser mode is active
   */
  isActive(): boolean {
    return this.initialized;
  }

  /**
   * Mark browser as initialized when mode is activated
   */
  markInitialized(): void {
    this.initialized = true;
  }

  /**
   * Register the MCP client for this server
   * Called after the client is obtained from the pool
   */
  setClient(client: McpClient): void {
    this.client = client;
  }

  /**
   * Ensure browser server is initialized (lazy initialization)
   * Called before first browser tool use
   * Sends state restoration request if available
   */
  async ensureInitialized(): Promise<void> {
    if (this.serverInitialized || !this.client) return;

    try {
      // Send initial state if we have one (from restore)
      if (this.previousState) {
        await this.client.request("restore_state", {
          state: this.previousState,
        });
        this.previousState = undefined; // Clear after restoration
      }

      this.serverInitialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get current browser state for serialization (called before /compact)
   */
  async captureState(): Promise<BrowserState> {
    if (!this.serverInitialized || !this.client) {
      // Browser was never used, return empty state
      return { port: 9222 };
    }

    try {
      const state = await this.client.request("get_state", {});
      return state as BrowserState;
    } catch (error) {
      console.warn(
        `Failed to capture browser state: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return { port: 9222 };
  }

  /**
   * Restore browser state (called after /compact)
   */
  async restoreState(state: BrowserState): Promise<void> {
    // Store state for lazy restoration when server initializes
    this.previousState = state;
    // Don't initialize server yet - wait for first tool call
  }

  /**
   * Clean up browser resources before shutdown
   */
  async cleanup(): Promise<void> {
    if (this.serverInitialized && this.client) {
      try {
        await this.client.request("close", {});
      } catch (error) {
        console.warn(
          `Failed to close browser: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.serverInitialized = false;
    this.initialized = false;
    this.client = null;
  }

  /**
   * Guard for browser tool calls
   * Ensures initialization before tool execution
   */
  async withInitialization<T>(fn: () => Promise<T>): Promise<T> {
    await this.ensureInitialized();
    return fn();
  }
}
