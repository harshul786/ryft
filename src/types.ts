export type Role = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
}

export interface Skill {
  name: string;
  description: string;
  file?: string;
}

export interface McpServer {
  name: string;
  description: string;
}

export interface BrowserTab {
  id: string;
  title: string;
  url: string;
  type: string;
  webSocketDebuggerUrl?: string;
}

export interface BrowserController {
  name: string;
  description: string;
  isReady(): Promise<boolean>;
  openUrl(url: string): Promise<BrowserTab | null>;
  listTabs(): Promise<BrowserTab[]>;
  openDevTools(tabId?: string): Promise<void>;
  close(): Promise<void>;
}

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  description: string;
  baseUrl?: string;
  aliases?: string[];
}

export type MemoryModeName = 'claude-like' | 'hierarchy' | 'session';

export interface MemoryMode {
  name: MemoryModeName;
  description: string;
  prompt: string;
}

export interface Mode {
  name: string;
  description: string;
  prompt: string;
  skillRoots: string[];
  skills?: Skill[];
  mcpServers: McpServer[];
  memory: MemoryModeName;
}

export interface SessionConfig {
  modes: Mode[];
  memoryMode: MemoryModeName;
  model: ModelOption;
  cwd?: string;
  homeDir?: string;
  proxyUrl: string | null;
  baseUrl: string;
  apiKey: string;
}

export interface MemoryState {
  snapshot: string;
}
