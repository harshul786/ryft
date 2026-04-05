/**
 * Skill Frontmatter Parser
 * 
 * Parses YAML frontmatter and markdown content to extract rich skill metadata
 * including execution context, tool policies, conditional activation, and hooks.
 */

import { readFile } from 'node:fs/promises';
import type { Skill, SkillMetadata, ExecutionContext, HooksSettings, EffortLevel } from './types.ts';

/**
 * Simple YAML parser for frontmatter
 * Extracts key-value pairs from YAML between --- delimiters
 */
export function parseFrontmatter(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  // Find frontmatter block between --- delimiters
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return result;
  }

  const frontmatterText = frontmatterMatch[1];
  const lines = frontmatterText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Parse YAML key: value format
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const valueStr = trimmed.slice(colonIdx + 1).trim();

    // Parse different value types
    let value: unknown = valueStr;

    // Boolean values
    if (valueStr === 'true') value = true;
    else if (valueStr === 'false') value = false;
    // Numbers
    else if (/^\d+$/.test(valueStr)) value = parseInt(valueStr, 10);
    else if (/^\d+\.\d+$/.test(valueStr)) value = parseFloat(valueStr);
    // Quoted strings (remove quotes)
    else if ((valueStr.startsWith('"') && valueStr.endsWith('"')) ||
             (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
      value = valueStr.slice(1, -1);
    }
    // Arrays: comma-separated values [a, b, c]
    else if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
      const arrayContent = valueStr.slice(1, -1);
      value = arrayContent
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
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
 */
export function parseSkillMetadata(content: string): SkillMetadata {
  const fm = getFrontmatterData(content);
  
  // Get title from frontmatter or first H1 heading
  let title: string;
  if (typeof fm.title === 'string') {
    title = fm.title;
  } else {
    // Extract from # H1 heading
    const h1Match = content.match(/^# (.+)$/m);
    title = h1Match ? h1Match[1]!.trim() : 'Untitled Skill';
  }

  // Get description from frontmatter or first few lines
  let description: string;
  if (typeof fm.description === 'string') {
    description = fm.description;
  } else {
    // Extract from first paragraph after frontmatter/title
    const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n/, '');
    const lines = contentWithoutFrontmatter
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('#'));
    description = lines.slice(0, 3).join(' ') || 'No description';
  }

  // Extract optional metadata fields
  const metadata: SkillMetadata = {
    title,
    description,
  };

  if (typeof fm.effort === 'string') {
    metadata.effort = fm.effort as EffortLevel;
  }
  if (typeof fm['when-to-use'] === 'string' || typeof fm.whenToUse === 'string') {
    metadata.whenToUse = (fm['when-to-use'] || fm.whenToUse) as string;
  }
  if (typeof fm.author === 'string') {
    metadata.author = fm.author;
  }
  if (Array.isArray(fm.tags)) {
    metadata.tags = fm.tags.map(t => String(t));
  }
  if (typeof fm.version === 'string') {
    metadata.version = fm.version;
  }

  return metadata;
}

/**
 * Extract execution context from skill content
 */
export function extractContext(content: string): ExecutionContext | undefined {
  const fm = getFrontmatterData(content);
  
  if (fm.context === 'inline' || fm.context === 'fork') {
    return fm.context as ExecutionContext;
  }
  
  return undefined;
}

/**
 * Extract tool policies (allowed and disabled tools) from skill content
 */
export function extractTools(content: string): { allowed?: string[], disabled?: string[] } {
  const fm = getFrontmatterData(content);
  const result: { allowed?: string[]; disabled?: string[] } = {};

  // Parse allowed tools (comma-separated)
  if (fm['allowed-tools'] || fm.allowedTools) {
    const toolStr = fm['allowed-tools'] || fm.allowedTools;
    if (typeof toolStr === 'string') {
      result.allowed = toolStr
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
    } else if (Array.isArray(toolStr)) {
      result.allowed = toolStr.map(t => String(t));
    }
  }

  // Parse disabled tools (comma-separated)
  if (fm['disabled-tools'] || fm.disabledTools) {
    const toolStr = fm['disabled-tools'] || fm.disabledTools;
    if (typeof toolStr === 'string') {
      result.disabled = toolStr
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
    } else if (Array.isArray(toolStr)) {
      result.disabled = toolStr.map(t => String(t));
    }
  }

  return result;
}

/**
 * Extract glob patterns for conditional skill activation based on file paths
 */
export function extractPaths(content: string): string[] | undefined {
  const fm = getFrontmatterData(content);
  
  if (fm.paths) {
    if (typeof fm.paths === 'string') {
      return fm.paths
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);
    } else if (Array.isArray(fm.paths)) {
      return fm.paths.map(p => String(p));
    }
  }

  return undefined;
}

/**
 * Extract hooks configuration from skill content
 */
export function extractHooks(content: string): HooksSettings | undefined {
  const fm = getFrontmatterData(content);
  
  if (fm.hooks && typeof fm.hooks === 'object') {
    return fm.hooks as HooksSettings;
  }

  return undefined;
}

/**
 * Extract whether this skill can be invoked via CLI commands
 */
export function extractUserInvocable(content: string): boolean {
  const fm = getFrontmatterData(content);
  
  if (fm['user-invocable'] !== undefined) {
    return fm['user-invocable'] === true || fm['user-invocable'] === 'true';
  }
  if (fm.userInvocable !== undefined) {
    return fm.userInvocable === true || fm.userInvocable === 'true';
  }

  // Default to true if not specified
  return true;
}

/**
 * Extract model override for this specific skill
 */
export function extractModel(content: string): string | undefined {
  const fm = getFrontmatterData(content);
  
  if (typeof fm.model === 'string') {
    return fm.model;
  }

  return undefined;
}

/**
 * Extract agent type for forked skills
 */
export function extractAgent(content: string): string | undefined {
  const fm = getFrontmatterData(content);
  
  if (typeof fm.agent === 'string') {
    return fm.agent;
  }

  return undefined;
}

/**
 * Enrich a skill by reading its file and parsing all metadata
 * 
 * This is the primary entry point for skill enrichment - it reads the skill file
 * and populates all extended metadata fields.
 */
export async function enrichSkillFromFile(skill: Skill, filePath: string): Promise<Skill> {
  try {
    const content = await readFile(filePath, 'utf8');
    
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
 * Validate skill frontmatter
 * Returns errors array if validation fails, empty array if valid
 */
export function validateSkillFrontmatter(content: string): string[] {
  const errors: string[] = [];
  const fm = getFrontmatterData(content);

  // Validate context field
  if (fm.context && fm.context !== 'inline' && fm.context !== 'fork') {
    errors.push(`Invalid context: "${fm.context}". Must be 'inline' or 'fork'.`);
  }

  // Validate effort field
  const validEfforts = ['Low', 'Medium', 'High'];
  if (fm.effort && !validEfforts.includes(String(fm.effort))) {
    errors.push(`Invalid effort: "${fm.effort}". Must be Low, Medium, or High.`);
  }

  // Validate paths (should be glob patterns)
  const paths = extractPaths(content);
  if (paths && paths.length === 0) {
    errors.push('paths field specified but empty or malformed.');
  }

  return errors;
}
