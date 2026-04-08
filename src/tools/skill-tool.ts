/**
 * Skill Invocation Tool
 *
 * Allows models to invoke skills by name with optional arguments.
 * Skills are executed inline by embedding their content in the prompt.
 */

import { readFile } from "node:fs/promises";
import type { Skill } from "../types.ts";
import { getModeSkills } from "../modes/skill-merger.ts";
import type { Mode } from "../types.ts";

export interface SkillInvocationRequest {
  skillName: string;
  context?: string;
  arguments?: Record<string, string>;
}

export interface SkillInvocationResult {
  success: boolean;
  skillName: string;
  content?: string;
  error?: string;
}

/**
 * Invoke a skill by name and return its content to be embedded in the model context
 *
 * @param skillName - Name of the skill to invoke
 * @param modes - Active modes to search within
 * @returns Skill content or error message
 *
 * @example
 * const result = await invokeSkill('compact', [coderMode]);
 * // Model can now use the skill instructions
 */
export async function invokeSkill(
  skillName: string,
  modes: Mode[],
): Promise<SkillInvocationResult> {
  try {
    // Load skills from all active modes
    const skillPromises = modes.map((mode) => getModeSkills(mode));
    const skillArrays = await Promise.all(skillPromises);

    // Flatten and find the requested skill
    const allSkills = skillArrays.flat();
    const skill = allSkills.find((s) => s.name === skillName);

    if (!skill) {
      return {
        success: false,
        skillName,
        error: `Skill not found: ${skillName}. Available: ${allSkills.map((s) => s.name).join(", ")}`,
      };
    }

    // Read the raw skill file content (the full SKILL.md with instructions),
    // then fall back to synthesised metadata if the file isn't accessible.
    let fileContent: string | undefined;
    if (skill.file) {
      try {
        fileContent = await readFile(skill.file, "utf-8");
      } catch {
        // File unreadable — we'll fall back to metadata only
      }
    }

    const skillContent = formatSkillForModel(skill, fileContent);

    return {
      success: true,
      skillName,
      content: skillContent,
    };
  } catch (error) {
    return {
      success: false,
      skillName,
      error: `Failed to invoke skill: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Format skill information for the model to understand and use.
 * When the raw file content is available, it is included in full so the model
 * receives the complete skill instructions rather than just extracted metadata.
 */
function formatSkillForModel(skill: Skill, fileContent?: string): string {
  if (fileContent) {
    // Strip YAML frontmatter (between leading --- delimiters) — we only want
    // the human-readable instruction body for the model.
    const withoutFrontmatter = fileContent
      .replace(/^---[\s\S]*?---\s*/m, "")
      .trim();
    if (withoutFrontmatter.length > 0) {
      return `# Skill: ${skill.name}\n\n${withoutFrontmatter}`;
    }
  }

  // Fallback: synthesise from metadata fields
  const lines = [`# Skill: ${skill.name}`, `Description: ${skill.description}`];

  if (skill.metadata?.title) {
    lines.push(`Title: ${skill.metadata.title}`);
  }

  if (skill.metadata?.whenToUse) {
    lines.push(`\n## When to Use\n${skill.metadata.whenToUse}`);
  }

  if (skill.metadata?.description) {
    lines.push(`\n## Details\n${skill.metadata.description}`);
  }

  if (skill.allowedTools && skill.allowedTools.length > 0) {
    lines.push(`\nAllowed Tools: ${skill.allowedTools.join(", ")}`);
  }

  if (skill.context) {
    lines.push(`Execution Context: ${skill.context}`);
  }

  return lines.join("\n");
}

/**
 * Get description of skill tool for model capabilities
 */
export function getSkillToolDescription(): string {
  return `# Skill Invocation Tool

You can invoke skills to extend your capabilities. Skills are specialized instructions for specific tasks.

## How to Invoke

Use the 'skill' tool to invoke a skill by name. Available skills are listed in the system prompt.

## Example

To use the "compact" skill:
\`\`\`
INVOKE SKILL: compact
\`\`\`

Or when chatting, reference the skill you want to use and the system will provide its instructions.`;
}
