/**
 * Skill Frontmatter Parser
 *
 * Parses YAML frontmatter and markdown content to extract rich skill metadata
 * including execution context, tool policies, conditional activation, and hooks.
 */

import { readFile } from "node:fs/promises";
import type {
  Skill,
  SkillMetadata,
  ExecutionContext,
  HooksSettings,
  EffortLevel,
} from "./types.ts";

/**
 * Simple YAML parser for skill frontmatter
 *
 * Parses key-value pairs from YAML frontmatter (text between --- delimiters).
 *
 * **Supported types:**
 * - `true` / `false` → Booleans
 * - `42`, `1.5` → Numbers
 * - `"string"` → Quoted strings
 * - `[a, b, c]` → Arrays (comma-separated)
 * - `key: value` → Default treated as string
 *
 * **Example:**
 * ```markdown
 * ---
 * name: my-skill
 * context: fork
 * enabled: true
 * tags: [a, b, c]
 * ---
 * ```
 * → `{ name: 'my-skill', context: 'fork', enabled: true, tags: ['a', 'b', 'c'] }`
 *
 * @param content - Raw markdown content (with optional frontmatter at start)
 * @returns Object with parsed frontmatter data, empty object if no frontmatter found
 */
export function parseFrontmatter(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Find frontmatter block between --- delimiters
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return result;
  }

  const frontmatterText = frontmatterMatch[1];
  const lines = frontmatterText.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Parse YAML key: value format
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const valueStr = trimmed.slice(colonIdx + 1).trim();

    // Parse different value types
    let value: unknown = valueStr;

    // Boolean values
    if (valueStr === "true") value = true;
    else if (valueStr === "false") value = false;
    // Numbers
    else if (/^\d+$/.test(valueStr)) value = parseInt(valueStr, 10);
    else if (/^\d+\.\d+$/.test(valueStr)) value = parseFloat(valueStr);
    // Quoted strings (remove quotes)
    else if (
      (valueStr.startsWith('"') && valueStr.endsWith('"')) ||
      (valueStr.startsWith("'") && valueStr.endsWith("'"))
    ) {
      value = valueStr.slice(1, -1);
    }
    // Arrays: comma-separated values [a, b, c]
    else if (valueStr.startsWith("[") && valueStr.endsWith("]")) {
      const arrayContent = valueStr.slice(1, -1);
      value = arrayContent
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Extract frontmatter data from skill content
 */
function getFrontmatterData(content: string): Record<string, unknown> {
  return parseFrontmatter(content);
}

/**
 * Extract skill metadata (title, description, etc.) from frontmatter or markdown
 *
 * Falls back to markdown structure if frontmatter fields not found:
 * - Title: from `title:` field or first `# H1` heading
 * - Description: from `description:` field or first paragraph
 * - Other fields: effort, author, tags, version, whenToUse
 *
 * **Example:**
 * ```
 * const metadata = parseSkillMetadata(skillContent);
 * console.log(metadata.title);       // 'My Skill'
 * console.log(metadata.description); // 'A great skill...'
 * ```
 *
 * @param content - Markdown content with optional frontmatter
 * @returns SkillMetadata object with all extracted fields and sensible defaults
 */
export function parseSkillMetadata(content: string): SkillMetadata {
  const fm = getFrontmatterData(content);

  // Get title from frontmatter or first H1 heading
  let title: string;
  if (typeof fm.title === "string") {
    title = fm.title;
  } else {
    // Extract from # H1 heading
    const h1Match = content.match(/^# (.+)$/m);
    title = h1Match ? h1Match[1]!.trim() : "Untitled Skill";
  }

  // Get description from frontmatter or first few lines
  let description: string;
  if (typeof fm.description === "string") {
    description = fm.description;
  } else {
    // Extract from first paragraph after frontmatter/title
    const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n/, "");
    const lines = contentWithoutFrontmatter
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
    description = lines.slice(0, 3).join(" ") || "No description";
  }

  // Extract optional metadata fields
  const metadata: SkillMetadata = {
    title,
    description,
  };

  if (typeof fm.effort === "string") {
    metadata.effort = fm.effort as EffortLevel;
  }
  if (
    typeof fm["when-to-use"] === "string" ||
    typeof fm.whenToUse === "string"
  ) {
    metadata.whenToUse = (fm["when-to-use"] || fm.whenToUse) as string;
  }
  if (typeof fm.author === "string") {
    metadata.author = fm.author;
  }
  if (Array.isArray(fm.tags)) {
    metadata.tags = fm.tags.map((t) => String(t));
  }
  if (typeof fm.version === "string") {
    metadata.version = fm.version;
  }

  return metadata;
}

/**
 * Extract execution context from skill content
 *
 * Determines whether skill runs inline (blocking, in same context) or fork
 * (in sub-agent with separate context).
 *
 * **Valid values:**
 * - `inline` - Skill expands into current conversation
 * - `fork` - Skill runs in separate sub-agent context
 * - `undefined` - Not specified, caller decides default
 *
 * **Example:**
 * ```yaml
 * ---
 * context: fork
 * agent: Bash
 * ---
 * ```
 *
 * @param content - Markdown content
 * @returns 'inline' | 'fork' | undefined
 */
export function extractContext(content: string): ExecutionContext | undefined {
  const fm = getFrontmatterData(content);

  if (fm.context === "inline" || fm.context === "fork") {
    return fm.context as ExecutionContext;
  }

  return undefined;
}

/**
 * Extract tool policies (allowed and disabled tools) from skill content
 *
 * **allowed-tools**: Whitelist - skill can ONLY use these tools
 * **disabled-tools**: Blacklist - skill CANNOT use these tools
 *
 * Both support:
 * - CSV: `bash,node,git`
 * - Array: `[bash, node, git]`
 * - YAML fields: `allowed-tools:` or `allowedTools:`
 *
 * **Example:**
 * ```yaml
 * ---
 * allowed-tools: bash,node,typescript
 * disabled-tools: [python, ruby]
 * ---
 * ```
 *
 * @param content - Markdown content
 * @returns Object with optional `allowed` and `disabled` string arrays
 * @example
 * const tools = extractTools(content);
 * if (tools.disabled?.includes('rm')) console.log('Deletion blocked');
 */
export function extractTools(content: string): {
  allowed?: string[];
  disabled?: string[];
} {
  const fm = getFrontmatterData(content);
  const result: { allowed?: string[]; disabled?: string[] } = {};

  // Parse allowed tools (comma-separated)
  if (fm["allowed-tools"] || fm.allowedTools) {
    const toolStr = fm["allowed-tools"] || fm.allowedTools;
    if (typeof toolStr === "string") {
      result.allowed = toolStr
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    } else if (Array.isArray(toolStr)) {
      result.allowed = toolStr.map((t) => String(t));
    }
  }

  // Parse disabled tools (comma-separated)
  if (fm["disabled-tools"] || fm.disabledTools) {
    const toolStr = fm["disabled-tools"] || fm.disabledTools;
    if (typeof toolStr === "string") {
      result.disabled = toolStr
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    } else if (Array.isArray(toolStr)) {
      result.disabled = toolStr.map((t) => String(t));
    }
  }

  return result;
}

/**
 * Extract conditional activation paths from skill content
 *
 * Glob patterns for files where this skill becomes available.
 * Skill activates when editing matching files.
 *
 * @param content - Markdown content
 * @returns Array of glob patterns, or undefined if not specified
 */
export function extractPaths(content: string): string[] | undefined {
  const fm = getFrontmatterData(content);

  if (fm.paths) {
    if (typeof fm.paths === "string") {
      return fm.paths
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    } else if (Array.isArray(fm.paths)) {
      return fm.paths.map((p) => String(p));
    }
  }

  return undefined;
}

/**
 * Extract hooks configuration from skill content
 */
export function extractHooks(content: string): HooksSettings | undefined {
  const fm = getFrontmatterData(content);

  if (fm.hooks && typeof fm.hooks === "object") {
    return fm.hooks as HooksSettings;
  }

  return undefined;
}

/**
 * Extract whether this skill can be invoked via CLI commands
 */
export function extractUserInvocable(content: string): boolean {
  const fm = getFrontmatterData(content);

  if (fm["user-invocable"] !== undefined) {
    return fm["user-invocable"] === true || fm["user-invocable"] === "true";
  }
  if (fm.userInvocable !== undefined) {
    return fm.userInvocable === true || fm.userInvocable === "true";
  }

  // Default to true if not specified
  return true;
}

/**
 * Extract model override for this specific skill
 */
export function extractModel(content: string): string | undefined {
  const fm = getFrontmatterData(content);

  if (typeof fm.model === "string") {
    return fm.model;
  }

  return undefined;
}

/**
 * Extract agent type for forked skills
 */
export function extractAgent(content: string): string | undefined {
  const fm = getFrontmatterData(content);

  if (typeof fm.agent === "string") {
    return fm.agent;
  }

  return undefined;
}

/**
 * Enrich a skill by reading its file and parsing all metadata
 *
 * **This is the main entry point** for skill enrichment - reads the actual
 * SKILL.md file and populates:
 * - Metadata (title, description, author, version, etc.)
 * - Execution context (inline vs fork)
 * - Tool policies (allowed/disabled tools)
 * - Conditional activation paths
 * - Hooks and agent info
 * - Raw frontmatter for extensibility
 *
 * **Error handling:** Logs warnings on parse errors but returns base skill
 * (never throws). Frontend can check `skill.metadata` to verify enrichment worked.
 *
 * **Performance:** Single file read + parsing, <10ms typical.
 *
 * @param skill - Base skill object with at least `name` and `file` fields
 * @param filePath - Absolute path to SKILL.md file to read
 * @returns Promise resolving to enriched Skill with all metadata populated
 * @example
 * ```typescript
 * const baseSkill = { name: 'edit', file: 'skills/edit/SKILL.md' };
 * const enriched = await enrichSkillFromFile(baseSkill, '/abs/path/SKILL.md');
 * console.log(enriched.context); // 'inline' or 'fork'
 * ```
 */
export async function enrichSkillFromFile(
  skill: Skill,
  filePath: string,
): Promise<Skill> {
  try {
    const content = await readFile(filePath, "utf8");

    // Parse all metadata from the file
    const metadata = parseSkillMetadata(content);
    const context = extractContext(content);
    const tools = extractTools(content);
    const paths = extractPaths(content);
    const hooks = extractHooks(content);
    const userInvocable = extractUserInvocable(content);
    const model = extractModel(content);
    const agent = extractAgent(content);
    const frontmatterRaw = getFrontmatterData(content);

    // Return enriched skill
    return {
      ...skill,
      metadata,
      context,
      allowedTools: tools.allowed,
      disabledTools: tools.disabled,
      paths,
      hooks,
      userInvocable,
      model,
      agent,
      frontmatterRaw,
    };
  } catch (error) {
    // Log warning but return skill as-is
    console.warn(`Failed to enrich skill from ${filePath}:`, error);
    return skill;
  }
}

/**
 * Validate skill frontmatter structure
 *
 * Checks for:
 * - Valid context values (inline/fork)
 * - Valid effort levels (Low/Medium/High)
 * - Properly formatted paths
 * - Other structural issues
 *
 * **Note:** This validates only structure, not semantics.
 * (e.g., doesn't check if tools actually exist)
 *
 * @param content - Markdown content to validate
 * @returns Array of error messages, empty array if valid
 * @example
 * ```typescript
 * const errors = validateSkillFrontmatter(content);
 * if (errors.length > 0) {
 *   console.error('Validation failed:', errors);
 * }
 * ```
 */
export function validateSkillFrontmatter(content: string): string[] {
  const errors: string[] = [];
  const fm = getFrontmatterData(content);

  // Validate context field
  if (fm.context && fm.context !== "inline" && fm.context !== "fork") {
    errors.push(
      `Invalid context: "${fm.context}". Must be 'inline' or 'fork'.`,
    );
  }

  // Validate effort field
  const validEfforts = ["Low", "Medium", "High"];
  if (fm.effort && !validEfforts.includes(String(fm.effort))) {
    errors.push(
      `Invalid effort: "${fm.effort}". Must be Low, Medium, or High.`,
    );
  }

  // Validate paths (should be glob patterns)
  const paths = extractPaths(content);
  if (paths && paths.length === 0) {
    errors.push("paths field specified but empty or malformed.");
  }

  return errors;
}
