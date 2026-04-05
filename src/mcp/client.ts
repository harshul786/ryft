import { ChildProcess, spawn } from "node:child_process";
import type {
  McpServerConfig,
  McpServerInstance,
  ToolSchema,
} from "./protocol.ts";
import type { JsonRpcRequest, JsonRpcResponse } from "./protocol.ts";

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
      
      this.process = spawn(this.config.command, this.config.args || [], {
        env: { ...process.env, ...this.config.env },
        stdio: ["pipe", "pipe", "inherit"],
        cwd, // Set working directory for the subprocess
      });

      // Handle stdout (JSON-RPC responses)
      this.process.stdout?.on("data", (data) => {
        this.handleData(data.toString());
      });

      // Handle process exit
      this.process.on("exit", (code) => {
        console.warn(`MCP server ${this.config.id} exited with code ${code}`);
        this.process = null;
      });

      // Give server time to start
      await new Promise((resolve) => setTimeout(resolve, 500));
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
   * Spawn all servers in list
   */
  async spawnServers(
    configs: McpServerConfig[],
  ): Promise<Map<string, McpClient>> {
    const result = new Map<string, McpClient>();

    for (const config of configs) {
      try {
        const client = this.getClient(config);
        await client.spawn();
        result.set(config.id, client);
      } catch (error) {
        console.error(`Failed to spawn MCP server ${config.id}:`, error);
      }
    }

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
