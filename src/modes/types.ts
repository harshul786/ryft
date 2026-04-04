import type { McpServer, MemoryModeName, Mode, Skill } from '../types.ts';

export function createMode({
  name,
  description,
  prompt,
  skillRoots = [],
  skills = [],
  mcpServers = [],
  memory = 'claude-like',
}: {
  name: string;
  description: string;
  prompt: string;
  skillRoots?: string[];
  skills?: Skill[];
  mcpServers?: McpServer[];
  memory?: MemoryModeName;
}): Mode {
  return { name, description, prompt, skillRoots, skills, mcpServers, memory };
}
