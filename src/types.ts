export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
}

/**
 * Skill type - imported from skills/types.ts for consistency
 *
 * Skills are the primary unit of extensibility in Ryft. They can be:
 * - Bundled with the system
 * - Loaded from user/project directories
 * - Dynamically discovered based on file context
 */
export interface Skill {
  /** Unique numeric ID for the skill (1, 2, 3...) - assigned at creation */
  id?: number;

  /** Unique name for the skill (used for lookup and invocation) */
  name: string;

  /** Brief description of the skill's purpose */
  description: string;

  /** File path to the skill definition (markdown file) */
  file?: string;

  // ============ EXECUTION CONTEXT ============

  /** How the skill should be executed: 'inline' or 'fork' (sub-agent) */
  context?: "inline" | "fork";

  /** Sub-agent type to use when context is 'fork' */
  agent?: string;

  // ============ TOOL POLICIES ============

  /** Allowed tools for this skill (whitelist) */
  allowedTools?: string[];

  /** Disabled tools for this skill (blacklist) */
  disabledTools?: string[];

  // ============ CONDITIONAL ACTIVATION ============

  /** Glob patterns for file paths this skill applies to */
  paths?: string[];

  // ============ METADATA & DISCOVERY ============

  /** Rich metadata extracted from skill file */
  metadata?: {
    title: string;
    description: string;
    effort?: "Low" | "Medium" | "High";
    whenToUse?: string;
    author?: string;
    tags?: string[];
    version?: string;
  };

  /** Whether this skill can be invoked via CLI commands (e.g., /skill-name) */
  userInvocable?: boolean;

  // ============ HOOKS & LIFECYCLE ============

  /** Hooks registered on skill invocation */
  hooks?: Record<string, unknown>;

  // ============ INTERNAL / EXTENSIBILITY ============

  /** Raw frontmatter data for extensibility */
  frontmatterRaw?: Record<string, unknown>;

  /** Model override for this specific skill */
  model?: string;
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

export type MemoryModeName = "claude-like" | "hierarchy" | "session";

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
