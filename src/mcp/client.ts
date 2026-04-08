/**
 * MCP client — spawns and communicates with MCP server subprocesses over JSON-RPC.
 *
 * ⚠️  CRITICAL: DO NOT change stdio back to ["pipe", "pipe", "inherit"]
 * ═══════════════════════════════════════════════════════════════════════
 * Using "inherit" for child stderr caused a very hard-to-diagnose bug:
 *
 *   After a /mode switch, users could not type — keystrokes appeared BELOW
 *   the Ink TUI box instead of inside the input field (terminal out of raw mode).
 *
 * Cause (three bugs together):
 *   1. stdio: ["pipe", "pipe", "inherit"] — child processes share the parent's
 *      terminal file descriptor for stderr.  Any bytes they write bypass Ink's
 *      patchStderr() intercept and hit the terminal directly.
 *
 *   2. Timed-out children not killed — when spawnServers() hits the 10 s timeout,
 *      Promise.race() throws but the child process keeps running.  The browser-surff
 *      server (which needs a running Chrome) often fails its connection *after* the
 *      timeout, writing its error output to the raw terminal fd well after the mode-
 *      switch UI says "ready".
 *
 *   3. The combined effect: inherited stderr + delayed child output = raw terminal
 *      bytes landing inside Ink's alt-screen buffer at the wrong cursor position,
 *      making it look like the terminal lost raw mode.
 *
 * Fix:
 *   - stdio: ["pipe", "pipe", "pipe"]   — fully isolates child stderr.
 *   - child.stderr piped to feature logger — visible in debug logs, never on screen.
 *   - client.kill() on timeout           — abandoned process is cleaned up immediately.
 */

import { ChildProcess, spawn } from "node:child_process";
import type {
  McpServerConfig,
  McpServerInstance,
  ToolSchema,
} from "./protocol.ts";
import type { JsonRpcRequest, JsonRpcResponse } from "./protocol.ts";
import { getFeatureLogger } from "../logging/index.ts";

// TODO #15: Implement MCP process lifecycle
// TODO #16: Implement MCP tool discovery
export class McpClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests: Map<
    string | number,
    (response: JsonRpcResponse) => void
  > = new Map();
  private buffer = "";

  constructor(private config: McpServerConfig) {}

  /**
   * Spawn MCP server process and establish JSON-RPC channel
   */
  async spawn(): Promise<void> {
    if (this.process) {
      throw new Error(`MCP server ${this.config.id} is already running`);
    }

    try {
      // Use the project root as cwd
      const cwd = process.env.RYFT_PROJECT_ROOT || process.cwd();

      const log = getFeatureLogger("MCP");

      this.process = spawn(this.config.command, this.config.args || [], {
        env: { ...process.env, ...this.config.env },
        // "pipe" for all three fds — child stderr must NOT inherit the parent's
        // terminal fd or child startup noise will write directly to the terminal
        // after the spawn timeout fires, corrupting Ink's TUI layout.
        stdio: ["pipe", "pipe", "pipe"],
        cwd,
      });

      // Handle stdout (JSON-RPC responses)
      this.process.stdout?.on("data", (data) => {
        this.handleData(data.toString());
      });

      // Route child stderr through the feature logger so it never reaches the
      // terminal directly and doesn't corrupt Ink's TUI display.
      this.process.stderr?.on("data", (data) => {
        const text = data.toString().trim();
        if (text) log.debug(`[${this.config.id} stderr] ${text}`);
      });

      // Handle process exit
      this.process.on("exit", (code) => {
        log.debug(`MCP server ${this.config.id} exited with code ${code}`);
        this.process = null;
      });

      // Give server time to start
      await new Promise((resolve) => setTimeout(resolve, 500));

      // MCP protocol requires initialize handshake before any other requests
      try {
        await this.request("initialize", {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "ryft", version: "1.0.0" },
        });
        // Send initialized notification (fire-and-forget, no response expected)
        this.process!.stdin!.write(
          JSON.stringify({
            jsonrpc: "2.0",
            method: "notifications/initialized",
            params: {},
          }) + "\n",
        );
      } catch {
        // Some servers don't require initialize (e.g. custom ones) — ignore
      }
    } catch (error) {
      this.process = null;
      throw new Error(`Failed to spawn MCP server ${this.config.id}: ${error}`);
    }
  }

  /**
   * Kill MCP server process
   */
  async kill(): Promise<void> {
    if (!this.process) return;

    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      this.process.once("exit", () => {
        this.process = null;
        resolve();
      });

      this.process.kill("SIGTERM");
      setTimeout(() => {
        if (this.process) {
          this.process.kill("SIGKILL");
        }
        resolve();
      }, 5000);
    });
  }

  /**
   * Check if process is running
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Send JSON-RPC request and wait for response
   */
  async request(method: string, params?: unknown): Promise<unknown> {
    if (!this.isRunning()) {
      throw new Error(`MCP server ${this.config.id} is not running`);
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, (response) => {
        if (response.error) {
          reject(new Error(`RPC error: ${response.error.message}`));
        } else {
          resolve(response.result);
        }
      });

      try {
        this.process!.stdin!.write(JSON.stringify(request) + "\n");
      } catch (error) {
        this.pendingRequests.delete(id);
        reject(error);
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`RPC timeout for method ${method}`));
        }
      }, 30000);
    });
  }

  /**
   * List available tools from MCP server
   */
  async listTools(): Promise<ToolSchema[]> {
    try {
      const response = await this.request("tools/list");
      const typedResponse = response as { tools?: ToolSchema[] };
      return typedResponse.tools || [];
    } catch (error) {
      console.warn(`Failed to list tools from ${this.config.id}:`, error);
      return [];
    }
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(
    toolName: string,
    toolInput: Record<string, unknown>,
  ): Promise<unknown> {
    return this.request("tools/call", {
      name: toolName,
      arguments: toolInput,
    });
  }

  /**
   * Handle incoming JSON-RPC data
   */
  private handleData(data: string): void {
    this.buffer += data;

    // Try to parse complete JSON objects
    const lines = this.buffer.split("\n");
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const response = JSON.parse(line) as JsonRpcResponse;
        if (
          response.id !== undefined &&
          this.pendingRequests.has(response.id)
        ) {
          const handler = this.pendingRequests.get(response.id)!;
          this.pendingRequests.delete(response.id);
          handler(response);
        }
      } catch (error) {
        console.warn(`Failed to parse JSON-RPC response: ${line}`);
      }
    }

    // Keep incomplete data in buffer
    this.buffer = lines[lines.length - 1];
  }
}

/**
 * Create and manage MCP client instances
 */
export class McpClientPool {
  private clients: Map<string, McpClient> = new Map();

  /**
   * Get or create client for server config
   */
  getClient(config: McpServerConfig): McpClient {
    if (!this.clients.has(config.id)) {
      this.clients.set(config.id, new McpClient(config));
    }
    return this.clients.get(config.id)!;
  }

  /**
   * Spawn all servers in list — runs in parallel with a per-server timeout
   */
  async spawnServers(
    configs: McpServerConfig[],
    timeoutMs = 10_000,
  ): Promise<Map<string, McpClient>> {
    const result = new Map<string, McpClient>();

    const log = getFeatureLogger("MCP");

    const attempts = configs.map(async (config) => {
      const client = this.getClient(config);
      try {
        await Promise.race([
          client.spawn(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Spawn timeout for ${config.id}`)),
              timeoutMs,
            ),
          ),
        ]);
        result.set(config.id, client);
      } catch (error) {
        log.warn(
          `Failed to spawn MCP server ${config.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        // Kill the abandoned child process so it cannot write to the terminal
        // later via its lingering stderr fd and corrupt Ink's TUI display.
        void client.kill().catch(() => {});
      }
    });

    await Promise.all(attempts);
    return result;
  }

  /**
   * Kill all servers
   */
  async killAll(): Promise<void> {
    for (const client of this.clients.values()) {
      try {
        await client.kill();
      } catch (error) {
        console.error("Error killing MCP client:", error);
      }
    }
  }

  /**
   * Get all running clients
   */
  getRunningClients(): McpClient[] {
    return Array.from(this.clients.values()).filter((c) => c.isRunning());
  }

  /**
   * Clear pool (for cleanup)
   */
  async clear(): Promise<void> {
    await this.killAll();
    this.clients.clear();
  }
}
