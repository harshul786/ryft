import type { ResolvedModePack } from "../modes/pack-types.ts";
import type { McpServerConfig, McpServerInstance } from "./protocol.ts";

// TODO #14: Create MCP server registry from mode-pack definitions
export class McpServerRegistry {
  private registry: Map<string, McpServerConfig> = new Map();
  private instances: Map<string, McpServerInstance> = new Map();

  /**
   * Register MCP servers from mode pack definitions
   */
  registerFromPacks(packs: ResolvedModePack[]): void {
    for (const pack of packs) {
      if (!pack.mcpServers) continue;

      for (const server of pack.mcpServers) {
        const id = server.id || server.name;
        const config: McpServerConfig = {
          id,
          name: server.name,
          description: server.description,
          command: server.command || this.inferCommand(server.name),
          args: server.args,
        };

        this.registry.set(id, config);
      }
    }
  }

  /**
   * Get server configuration by ID
   */
  getServerConfig(serverId: string): McpServerConfig | undefined {
    return this.registry.get(serverId);
  }

  /**
   * Get all registered server configurations
   */
  getAllServers(): McpServerConfig[] {
    return Array.from(this.registry.values());
  }

  /**
   * Check if server is registered
   */
  hasServer(serverId: string): boolean {
    return this.registry.has(serverId);
  }

  /**
   * Register a server instance (running process)
   */
  setInstance(serverId: string, instance: McpServerInstance): void {
    this.instances.set(serverId, instance);
  }

  /**
   * Get server instance
   */
  getInstance(serverId: string): McpServerInstance | undefined {
    return this.instances.get(serverId);
  }

  /**
   * Get all instances
   */
  getAllInstances(): McpServerInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * List all running servers
   */
  getRunningServers(): McpServerInstance[] {
    return Array.from(this.instances.values()).filter((i) => i.isRunning);
  }

  /**
   * Clear all instances (for cleanup/reset)
   */
  clearInstances(): void {
    this.instances.clear();
  }

  /**
   * Infer command from server name (fallback)
   * e.g., "filesystem" -> "mcp-filesystem"
   */
  private inferCommand(name: string): string {
    return `mcp-${name}`;
  }
}

/**
 * Global singleton registry
 */
let globalRegistry: McpServerRegistry | null = null;

export function getGlobalMcpRegistry(): McpServerRegistry {
  if (!globalRegistry) {
    globalRegistry = new McpServerRegistry();
  }
  return globalRegistry;
}

export function resetGlobalMcpRegistry(): void {
  globalRegistry = null;
}
