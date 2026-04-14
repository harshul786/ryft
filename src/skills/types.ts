/**
 * Skill Type Definitions
 *
 * Complete type system for Ryft skills, including metadata for execution,
 * tool policies, conditional activation, and hooks.
 */

/**
 * Execution context for skill invocation
 * - 'inline': Skill content expands into the current conversation
 * - 'fork': Skill runs as a sub-agent with separate context and token budget
 */
export type ExecutionContext = "inline" | "fork";

/**
 * Effort estimation for skill complexity
 */
export type EffortLevel = "Low" | "Medium" | "High";

/**
 * Hooks that can be registered on skill invocation
 * These allow skills to respond to specific lifecycle events
 */
export interface HooksSettings {
  /** Called after sampling/generation */
  postSampling?: {
    /** Custom post-processing logic */
    enabled?: boolean;
  };
  /** Other hook types can be added as needed */
  [key: string]: unknown;
}

/**
 * Skill metadata extracted from frontmatter and markdown content
 * Provides human-readable information about the skill
 */
export interface SkillMetadata {
  /** Display title for the skill */
  title: string;

  /** Description of what the skill does */
  description: string;

  /** Effort level to execute this skill */
  effort?: EffortLevel;

  /** When to use this skill (e.g., use case scenarios) */
  whenToUse?: string;

  /** Author or maintainer of the skill */
  author?: string;

  /** Tags for categorization and discovery */
  tags?: string[];

  /** Version of the skill */
  version?: string;
}

/**
 * Enhanced Skill definition with full metadata and execution configuration
 *
 * Skills are the primary unit of extensibility in Ryft. They can be:
 * - Bundled with the system
 * - Loaded from user/project directories
 * - Provided by MCP servers
 * - Dynamically discovered based on file context
 */
export interface Skill {
  /** Unique name for the skill (used for lookup and invocation) */
  name: string;

  /** Brief description of the skill's purpose */
  description: string;

  /** File path to the skill definition (markdown file) */
  file?: string;

  // ============ EXECUTION CONTEXT ============

  /** How the skill should be executed */
  context?: ExecutionContext;

  /** Sub-agent type to use when context is 'fork' (e.g., 'Bash', 'general-purpose') */
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
  metadata?: SkillMetadata;

  /** Whether this skill can be invoked via CLI commands (e.g., /skill-name) */
  userInvocable?: boolean;

  // ============ MCP SKILLS INTEGRATION ============

  /** Whether this skill comes from an MCP server */
  isMCPSkill?: boolean;

  /** Name of the MCP server this skill came from */
  mcpServer?: string;

  /** Trust level for this skill (MCP skills default to 'untrusted') */
  trustLevel?: "trusted" | "untrusted";

  // ============ HOOKS & LIFECYCLE ============

  /** Hooks registered on skill invocation */
  hooks?: HooksSettings;

  // ============ INTERNAL / EXTENSIBILITY ============

  /** Raw frontmatter data for extensibility */
  frontmatterRaw?: Record<string, unknown>;

  /** Model override for this specific skill */
  model?: string;
}

/**
 * Skill source type - identifies where a skill comes from
 * Used for precedence and filtering decisions
 */
export type SkillSource =
  | "bundled"
  | "user"
  | "project"
  | "mode"
  | "mcp"
  | "dynamic";

/**
 * Tool policy result - represents computed tool access for a skill
 */
export interface ToolPolicy {
  allowed?: Set<string>;
  disabled?: Set<string>;
}

/**
 * Skill filter options for targeted discovery
 */
export interface SkillFilterOptions {
  /** Filter by source */
  source?: SkillSource;

  /** Filter by execution context */
  context?: ExecutionContext;

  /** Filter by required tool access */
  requiredTools?: string[];

  /** Filter by effort level */
  effort?: EffortLevel;
}
