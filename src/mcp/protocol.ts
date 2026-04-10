// MCP JSON-RPC message types

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

// MCP Tool types
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  outputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
  };
}

export interface ToolSchema extends ToolDefinition {}

// Compressed tool schema for prompt context
export interface CompressedToolSchema {
  name: string;
  description: string; // short, one sentence
  inputSchema?: {
    type: string;
    properties?: Record<
      string,
      {
        type: string;
        description?: string;
        items?: unknown; // For array types
        enum?: unknown[]; // For enum types
      }
    >;
    required?: string[];
  };
}

// Tool call from LLM
export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// Tool result
export interface ToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

// MCP Server configuration
export interface McpServerConfig {
  id: string; // unique server ID
  name: string;
  description: string;
  command: string; // executable to spawn
  args?: string[];
  env?: Record<string, string>;
}

// MCP Server instance (running)
export interface McpServerInstance {
  config: McpServerConfig;
  process?: NodeJS.Process;
  tools?: ToolSchema[];
  compressedTools?: CompressedToolSchema[];
  isRunning: boolean;
}

// Tool registry entry
export interface RegistryEntry {
  serverId: string;
  serverName: string;
  tool: ToolSchema;
  compressed: CompressedToolSchema;
}
