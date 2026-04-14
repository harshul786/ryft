export type Role = "system" | "user" | "assistant" | "tool";

// ─── Structured message content parts ────────────────────────────────────────
// Used when a message carries more than plain text (e.g. tool calls / results).

/** Plain text segment inside a structured message */
export interface TextContentPart {
  type: "text";
  text: string;
}

/**
 * A tool invocation emitted by the model.
 * Mirrors the OpenAI / Anthropic `tool_use` block shape.
 */
export interface ToolUseContentPart {
  type: "tool_use";
  /** Stable identifier for this call, used to match the corresponding result */
  id: string;
  /** Tool name exactly as registered in the tool registry */
  name: string;
  /** Parsed arguments supplied by the model */
  input: Record<string, unknown>;
}

/**
 * The result of executing a tool call, sent back to the model.
 * Added as a `user` role message so the model can see the output.
 */
export interface ToolResultContentPart {
  type: "tool_result";
  /** Must match the `id` of the originating `ToolUseContentPart` */
  tool_use_id: string;
  /** Stringified output from the tool */
  content: string;
  /** True when the tool execution threw an error */
  is_error?: boolean;
  /**
   * Base64 data URL (e.g. "data:image/png;base64,...") when the tool returned
   * an image (e.g. a browser screenshot). Stored separately so it can be
   * forwarded as a vision-capable HumanMessage rather than embedded as raw text.
   */
  imageData?: string;
}

/** Union of all structured content parts that can appear in a message */
export type MessageContentPart =
  | TextContentPart
  | ToolUseContentPart
  | ToolResultContentPart;

// ─── Core message type ────────────────────────────────────────────────────────

export interface ChatMessage {
  role: Role;
  /**
   * Either a plain string (most messages) or an array of structured parts
   * (messages that involve tool calls or tool results).
   */
  content: string | MessageContentPart[];
  /**
   * Present only on `role: "tool"` messages.
   * Must match the `id` of the originating tool call so the model can
   * correlate the result with its earlier `tool_use` block.
   */
  tool_call_id?: string;
}

/**
 * Extract the plain-text portion of a message's content.
 * Returns the full string for string-content messages, or the concatenation
 * of all `text` parts for structured messages. Safe for logging / display.
 */
export function getMessageText(msg: ChatMessage): string {
  if (typeof msg.content === "string") return msg.content;
  return msg.content
    .filter((p): p is TextContentPart => p.type === "text")
    .map((p) => p.text)
    .join("");
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

export type ProviderType =
  | "openai"
  | "anthropic"
  | "google"
  | "ollama"
  | "openai-compatible";

// ─── Thinking mode configuration ──────────────────────────────────────────────

/**
 * Thinking configuration for extended reasoning (Claude 4+).
 * Supports three modes: adaptive (auto-budget), fixed-budget, or disabled.
 */
export type ThinkingConfig =
  | { type: "adaptive" }
  | { type: "enabled"; budgetTokens: number }
  | { type: "disabled" };

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  description: string;
  baseUrl?: string;
  aliases?: string[];
  /** Whether this model supports native function calling via the provider's API tools parameter.
   * When false (or omitted), tools are NOT passed to avoid prompt-injection JSON mode fallbacks. */
  nativeToolSupport?: boolean;
  /** Which LangChain provider adapter to use. Detected automatically from baseUrl/model prefix
   * when not set explicitly. Defaults to "openai-compatible" for unknown models. */
  providerType?: ProviderType;
  /** Whether this model supports extended thinking (Claude 4+) */
  supportsThinking?: boolean;
  /** Whether this model supports adaptive thinking without budget (Claude 4.6+) */
  supportsAdaptiveThinking?: boolean;
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
  /** OpenAI (and OpenAI-compatible) API base URL */
  baseUrl: string;
  /** OpenAI API key */
  apiKey: string;
  /** Anthropic API key (for claude-* models) */
  anthropicApiKey?: string;
  /** Google / Gemini API key (for gemini-* models) */
  geminiApiKey?: string;
  /** Ollama base URL (defaults to http://localhost:11434) */
  ollamaBaseUrl?: string;
  /** Thinking mode configuration (used for extended reasoning in Claude 4+) */
  thinkingConfig?: ThinkingConfig;
}

export interface MemoryState {
  snapshot: string;
}
