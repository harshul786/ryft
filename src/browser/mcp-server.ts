import { createBrowserController } from "./controller.ts";
import type { BrowserController, BrowserTab } from "../types.ts";

/**
 * Browser state for serialization/restoration
 */
export interface BrowserState {
  port: number;
  chromeBinary?: string;
  userDataDir?: string;
  urls?: string[];
  lastActiveTabId?: string;
}

/**
 * MCP server for browser automation
 * Runs as a standalone process that manages a browser instance and exposes methods via JSON-RPC
 */
export class BrowserMcpServer {
  private controller: BrowserController | null = null;
  private state: BrowserState = { port: 9222 };

  constructor(state?: BrowserState) {
    if (state) {
      this.state = state;
    }
  }

  /**
   * Initialize the browser controller
   */
  async initialize(): Promise<void> {
    this.controller = await createBrowserController({
      port: this.state.port,
      chromeBinary: this.state.chromeBinary,
      userDataDir: this.state.userDataDir,
    });
  }

  /**
   * Open a URL in the browser
   */
  async openUrl(
    url: string,
  ): Promise<{ tab: BrowserTab | null; success: boolean }> {
    if (!this.controller) {
      throw new Error("Browser controller not initialized");
    }
    try {
      const tab = await this.controller.openUrl(url);
      return { tab, success: tab !== null };
    } catch (error) {
      throw new Error(
        `Failed to open URL: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * List all browser tabs
   */
  async listTabs(): Promise<BrowserTab[]> {
    if (!this.controller) {
      throw new Error("Browser controller not initialized");
    }
    try {
      return await this.controller.listTabs();
    } catch (error) {
      throw new Error(
        `Failed to list tabs: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Open DevTools for a tab
   */
  async openDevTools(tabId?: string): Promise<void> {
    if (!this.controller) {
      throw new Error("Browser controller not initialized");
    }
    try {
      await this.controller.openDevTools(tabId);
    } catch (error) {
      throw new Error(
        `Failed to open DevTools: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    if (!this.controller) return;
    try {
      await this.controller.close();
      this.controller = null;
    } catch (error) {
      throw new Error(
        `Failed to close browser: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get current browser state for serialization
   */
  async getState(): Promise<BrowserState> {
    const tabs = this.controller ? await this.controller.listTabs() : [];
    const lastActiveTabId = tabs.find((t) => t.type === "page")?.id;

    return {
      ...this.state,
      urls: tabs.map((t) => t.url),
      lastActiveTabId,
    };
  }

  /**
   * Restore browser state from serialized data
   */
  async restoreState(prevState: BrowserState): Promise<void> {
    if (!this.controller) {
      throw new Error("Browser controller not initialized");
    }

    // Re-open URLs from previous state
    const tabs = await this.controller.listTabs();
    const currentUrls = tabs.map((t) => t.url);

    if (prevState.urls) {
      for (const url of prevState.urls) {
        if (!currentUrls.includes(url)) {
          await this.controller.openUrl(url);
        }
      }
    }
  }

  /**
   * Check if browser is ready
   */
  async isReady(): Promise<boolean> {
    if (!this.controller) return false;
    return this.controller.isReady();
  }
}

/**
 * JSON-RPC handler for browser MCP server
 */
export async function handleBrowserMcpRequest(
  method: string,
  params: Record<string, unknown>,
  server: BrowserMcpServer,
): Promise<unknown> {
  switch (method) {
    case "open_url":
      return server.openUrl(params.url as string);

    case "list_tabs":
      return server.listTabs();

    case "open_devtools":
      return server.openDevTools(params.tab_id as string | undefined);

    case "close":
      return server.close();

    case "get_state":
      return server.getState();

    case "restore_state":
      return server.restoreState(params.state as BrowserState);

    case "is_ready":
      return server.isReady();

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

/**
 * Main entry point if run as standalone process
 * Reads state from stdio, initializes server, and handles JSON-RPC calls
 */
export async function runBrowserMcpServerProcess(): Promise<void> {
  let server: BrowserMcpServer | null = null;

  // Read initial state from stdin
  const initStateStr = await new Promise<string>((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => {
      data += chunk.toString();
      if (data.includes("\n")) {
        process.stdin.pause();
        resolve(data.trim());
      }
    });
  });

  try {
    const initialState = JSON.parse(initStateStr) as BrowserState;
    server = new BrowserMcpServer(initialState);
    await server.initialize();

    // Signal ready
    process.stdout.write(JSON.stringify({ type: "ready" }) + "\n");

    // Handle JSON-RPC calls from stdin
    const rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    rl.on("line", async (line: string) => {
      try {
        const request = JSON.parse(line) as {
          id?: string | number;
          method: string;
          params?: Record<string, unknown>;
        };
        const result = await handleBrowserMcpRequest(
          request.method,
          request.params || {},
          server!,
        );
        const response = { id: request.id, result };
        process.stdout.write(JSON.stringify(response) + "\n");
      } catch (error) {
        const response = {
          id: undefined,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : String(error),
          },
        };
        process.stdout.write(JSON.stringify(response) + "\n");
      }
    });

    rl.on("close", async () => {
      if (server) {
        await server.close();
      }
      process.exit(0);
    });
  } catch (error) {
    const response = {
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    };
    process.stdout.write(JSON.stringify(response) + "\n");
    process.exit(1);
  }
}

// Run if this is the entry point
if (import.meta.main) {
  runBrowserMcpServerProcess().catch((error) => {
    console.error("Browser MCP server error:", error);
    process.exit(1);
  });
}
