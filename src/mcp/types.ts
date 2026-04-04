import type { McpServer } from '../types.ts';

export type { McpServer };

export function createMcpServer(name: string, description: string): McpServer {
  return { name, description };
}
