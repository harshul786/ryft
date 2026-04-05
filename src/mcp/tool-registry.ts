import type {
  ToolSchema,
  CompressedToolSchema,
  RegistryEntry,
} from "./protocol.ts";

// TODO #18: Build in-memory tool registry
export class ToolRegistry {
  private tools: Map<string, RegistryEntry> = new Map(); // key: "serverId:toolName"
  private toolsByServer: Map<string, RegistryEntry[]> = new Map();
  private toolsByName: Map<string, RegistryEntry[]> = new Map();

  /**
   * Add tool to registry
   */
  addTool(
    serverId: string,
    serverName: string,
    tool: ToolSchema,
    compressed: CompressedToolSchema,
  ): void {
    const key = `${serverId}:${tool.name}`;
    const entry: RegistryEntry = {
      serverId,
      serverName,
      tool,
      compressed,
    };

    this.tools.set(key, entry);

    // Index by server
    if (!this.toolsByServer.has(serverId)) {
      this.toolsByServer.set(serverId, []);
    }
    this.toolsByServer.get(serverId)!.push(entry);

    // Index by name
    if (!this.toolsByName.has(tool.name)) {
      this.toolsByName.set(tool.name, []);
    }
    this.toolsByName.get(tool.name)!.push(entry);
  }

  /**
   * Add multiple tools at once
   */
  addTools(
    serverId: string,
    serverName: string,
    tools: Array<{ full: ToolSchema; compressed: CompressedToolSchema }>,
  ): void {
    for (const { full, compressed } of tools) {
      this.addTool(serverId, serverName, full, compressed);
    }
  }

  /**
   * Get tool by server:name
   */
  getTool(serverId: string, toolName: string): RegistryEntry | undefined {
    return this.tools.get(`${serverId}:${toolName}`);
  }

  /**
   * Get all tools
   */
  getAllTools(): RegistryEntry[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools for specific server
   */
  getToolsForServer(serverId: string): RegistryEntry[] {
    return this.toolsByServer.get(serverId) || [];
  }

  /**
   * Get all tools with given name (from all servers)
   */
  getToolsByName(toolName: string): RegistryEntry[] {
    return this.toolsByName.get(toolName) || [];
  }

  /**
   * Get compressed tools only (for prompt)
   */
  getCompressedTools(): CompressedToolSchema[] {
    return Array.from(this.tools.values()).map((e) => e.compressed);
  }

  /**
   * Get compressed tools for specific server
   */
  getCompressedToolsForServer(serverId: string): CompressedToolSchema[] {
    return (this.toolsByServer.get(serverId) || []).map((e) => e.compressed);
  }

  /**
   * Get full tool schemas (for execution)
   */
  getFullTools(): ToolSchema[] {
    return Array.from(this.tools.values()).map((e) => e.tool);
  }

  /**
   * Get tool count
   */
  count(): number {
    return this.tools.size;
  }

  /**
   * Check if tool exists
   */
  hasTool(serverId: string, toolName: string): boolean {
    return this.tools.has(`${serverId}:${toolName}`);
  }

  /**
   * Clear registry
   */
  clear(): void {
    this.tools.clear();
    this.toolsByServer.clear();
    this.toolsByName.clear();
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTools: number;
    serverCount: number;
    toolsByServer: Record<string, number>;
  } {
    return {
      totalTools: this.tools.size,
      serverCount: this.toolsByServer.size,
      toolsByServer: Object.fromEntries(
        Array.from(this.toolsByServer.entries()).map(([serverId, tools]) => [
          serverId,
          tools.length,
        ]),
      ),
    };
  }
}

// Global singleton
let globalRegistry: ToolRegistry | null = null;

export function getGlobalToolRegistry(): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new ToolRegistry();
  }
  return globalRegistry;
}

export function resetGlobalToolRegistry(): void {
  globalRegistry = null;
}
