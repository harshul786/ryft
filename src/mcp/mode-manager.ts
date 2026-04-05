import type { Mode } from "../types.ts";
import type { ResolvedModePack } from "../modes/pack-types.ts";
import { getModePacks } from "../modes/pack-loader.ts";
import { McpServerRegistry } from "./registry.ts";
import { McpClientPool } from "./client.ts";
import { ToolRegistry } from "./tool-registry.ts";
import { compressToolSchema } from "./schema-compressor.ts";

// TODO #19: Wire MCP tool list into mode activation
export class ModeActivationManager {
  private registry: McpServerRegistry;
  private clientPool: McpClientPool;
  private toolRegistry: ToolRegistry;

  constructor() {
    this.registry = new McpServerRegistry();
    this.clientPool = new McpClientPool();
    this.toolRegistry = new ToolRegistry();
  }

  /**
   * Activate modes: discover MCP servers and tools
   */
  async activateModes(
    modes: Mode[],
  ): Promise<{ toolCount: number; serverCount: number }> {
    // Clear previous state
    await this.toolRegistry.clear();
    await this.clientPool.clear();
    this.registry.clearInstances();

    // Get mode packs
    const packs = getModePacks(
      modes.map((m) => m.name),
      process.cwd(),
    );

    if (packs.length === 0) {
      return { toolCount: 0, serverCount: 0 };
    }

    // Register servers from packs
    this.registry.registerFromPacks(packs);

    // Get server configs
    const serverConfigs = this.registry.getAllServers();
    if (serverConfigs.length === 0) {
      return { toolCount: 0, serverCount: 0 };
    }

    // Spawn MCP servers
    const spawnedClients = await this.clientPool.spawnServers(serverConfigs);

    // Discover tools from each server
    let totalTools = 0;
    for (const [serverId, client] of spawnedClients) {
      const config = this.registry.getServerConfig(serverId);
      if (!config) continue;

      try {
        const tools = await client.listTools();

        // Store server instance
        const instance = {
          config,
          process: (client as any).process,
          tools,
          compressedTools: tools.map(compressToolSchema),
          isRunning: client.isRunning(),
        };
        this.registry.setInstance(serverId, instance);

        // Add tools to registry
        const toolEntries = tools.map((tool) => ({
          full: tool,
          compressed: compressToolSchema(tool),
        }));
        this.toolRegistry.addTools(serverId, config.name, toolEntries);

        totalTools += tools.length;
      } catch (error) {
        console.warn(`Failed to discover tools from ${serverId}:`, error);
      }
    }

    return {
      toolCount: totalTools,
      serverCount: spawnedClients.size,
    };
  }

  /**
   * Deactivate modes: kill MCP servers
   */
  async deactivateModes(): Promise<void> {
    await this.clientPool.clear();
    this.toolRegistry.clear();
    this.registry.clearInstances();
  }

  /**
   * Get tool registry (compressed tools for prompt)
   */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  /**
   * Get client pool (for tool dispatch)
   */
  getClientPool(): McpClientPool {
    return this.clientPool;
  }

  /**
   * Get MCP registry
   */
  getMcpRegistry(): McpServerRegistry {
    return this.registry;
  }

  /**
   * Get all running servers
   */
  getRunningServers() {
    return this.registry.getRunningServers();
  }

  /**
   * Get tool stats
   */
  getStats() {
    return {
      tools: this.toolRegistry.getStats(),
      servers: this.registry.getRunningServers().length,
    };
  }
}
