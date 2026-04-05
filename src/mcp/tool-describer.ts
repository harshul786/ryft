/**
 * Tool Describer: Generate rich descriptions for tools and skills
 * 
 * This module creates context-aware descriptions for both MCP tools and skills,
 * making them discoverable and actionable for the model.
 * 
 * Following Claude-CLI patterns: Dynamic descriptions based on actual capabilities
 * and permissions, with explicit "when to use" guidance.
 */

import type { CompressedToolSchema } from "./protocol.ts";
import type { Skill } from "../types.ts";

/**
 * Describes a single MCP tool with when-to-use guidance
 */
export function describeToolForPrompt(tool: CompressedToolSchema): string {
  const params = tool.inputSchema?.properties
    ? Object.entries(tool.inputSchema.properties)
        .slice(0, 2)
        .map(([name, prop]) => `"${name}"`)
        .join(", ")
    : "";

  const paramDesc = params ? ` with \`${params}\`` : "";
  const exampleInput =
    tool.inputSchema?.properties && Object.keys(tool.inputSchema.properties).length > 0
      ? JSON.stringify(
          Object.entries(tool.inputSchema.properties)
            .slice(0, 2)
            .reduce(
              (acc, [key, prop]) => {
                // Type-appropriate default values
                if ((prop as any).type === "string") {
                  acc[key] = "example";
                } else if ((prop as any).type === "number") {
                  acc[key] = 0;
                } else if ((prop as any).type === "boolean") {
                  acc[key] = true;
                } else {
                  acc[key] = null;
                }
                return acc;
              },
              {} as Record<string, any>,
            ),
        )
      : "{}";

  // Determine when to use based on tool name patterns
  let whenToUse = "Use to retrieve information or perform tasks";
  if (tool.name.toLowerCase().includes("list"))
    whenToUse = "Use to discover or list available items";
  if (tool.name.toLowerCase().includes("invoke"))
    whenToUse = "Use to execute or run something";
  if (tool.name.toLowerCase().includes("read"))
    whenToUse = "Use to read or retrieve content";
  if (tool.name.toLowerCase().includes("write"))
    whenToUse = "Use to create or modify content";

  return `**${tool.name}**: ${tool.description}
  When to use: ${whenToUse}
  Parameters: ${paramDesc || "None (empty input)"}
  Example: \`<tool_use id="N" name="${tool.name}" input='${exampleInput}' />\``;
}

/**
 * Describes a single skill with when-to-use guidance
 */
export function describeSkillForPrompt(skill: Skill): string {
  const metadata = skill.metadata;
  const effort = metadata?.effort ? ` [Effort: ${metadata.effort}]` : "";
  const tags = metadata?.tags && metadata.tags.length > 0 ? ` [${metadata.tags.join(", ")}]` : "";
  const whenToUse = metadata?.whenToUse || "Use for specific task automation";

  return `**${skill.name}**: ${skill.description}${effort}${tags}
  When to use: ${whenToUse}
  Invoke with: \`<tool_use id="N" name="invoke_skill" input='{"skill": "${skill.name}"}' />\``;
}

/**
 * Format a section describing all available tools
 */
export function formatToolDescriptions(tools: CompressedToolSchema[]): string {
  if (tools.length === 0) {
    return "";
  }

  const descriptions = tools.map(describeToolForPrompt).join("\n\n");

  return `## Available Tools (MCP)

You have access to the following tools to help with tasks:

${descriptions}`;
}

/**
 * Format a section describing all available skills
 *
 * Skills are invoked via the invoke_skill tool, so this describes
 * what each skill does and when to use it.
 */
export function formatSkillDescriptions(skills: Skill[]): string {
  if (skills.length === 0) {
    return "";
  }

  const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));
  const descriptions = sorted.map(describeSkillForPrompt).join("\n\n");

  return `## Available Skills

These specialized skills handle specific tasks:

${descriptions}`;
}

/**
 * Combine tools and skills into a unified "what you can do" section
 *
 * This creates an integrated view where both tools and skills are presented
 * as discoverable, actionable capabilities.
 */
export function formatUnifiedCapabilities(
  tools: CompressedToolSchema[],
  skills: Skill[],
): string {
  const toolSection = formatToolDescriptions(tools);
  const skillSection = formatSkillDescriptions(skills);

  if (!toolSection && !skillSection) {
    return "";
  }

  const sections = [toolSection, skillSection].filter((s) => s.length > 0);

  return `## Capabilities

${sections.join("\n\n")}`;
}

/**
 * Create a task-to-capability mapping section
 *
 * Helps the model understand what tool/skill to use for different tasks
 */
export function formatTaskMapping(
  tools: CompressedToolSchema[],
  skills: Skill[],
): string {
  const toolMappings: string[] = [];
  const skillMappings: string[] = [];

  // Add tool mappings
  for (const tool of tools) {
    const taskName = tool.name
      .replace(/([A-Z])/g, " $1")
      .trim()
      .toLowerCase();

    if (tool.name.toLowerCase().includes("list")) {
      toolMappings.push(`- **To find available ${taskName}**: Use \`${tool.name}\``);
    } else if (tool.name.toLowerCase().includes("invoke")) {
      toolMappings.push(`- **To execute/run ${taskName}**: Use \`${tool.name}\``);
    } else {
      toolMappings.push(`- **For ${taskName}**: Use \`${tool.name}\``);
    }
  }

  // Add skill mappings
  for (const skill of skills) {
    const taskDesc = skill.metadata?.whenToUse || `use ${skill.name}`;
    skillMappings.push(`- **To ${taskDesc}**: Invoke \`${skill.name}\` skill`);
  }

  if (toolMappings.length === 0 && skillMappings.length === 0) {
    return "";
  }

  const sections: string[] = [];

  if (toolMappings.length > 0) {
    sections.push(`### Tool Selection Guide\n\n${toolMappings.join("\n")}`);
  }

  if (skillMappings.length > 0) {
    sections.push(`### Skill Selection Guide\n\n${skillMappings.join("\n")}`);
  }

  return sections.length > 0
    ? `## Task-to-Capability Mapping\n\n${sections.join("\n\n")}`
    : "";
}
