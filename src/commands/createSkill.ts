/**
 * Skill Creation Core Logic
 *
 * Handles parsing, validation, and generation of SKILL.md files
 * from structured input (from guided interview or direct specification)
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getFeatureLogger } from "../logging/index.ts";

const log = getFeatureLogger("SkillCreation");

/**
 * Schema for generated SKILL.md frontmatter
 */
export interface SkillFrontmatter {
  name: string;
  description: string;
  context?: "inline" | "fork";
  "allowed-tools"?: string[];
  effort?: "Low" | "Medium" | "High";
  when_to_use?: string;
}

/**
 * Complete skill definition result
 */
export interface SkillCreationResult {
  skillName: string;
  description: string;
  problem: string;
  filesContexts: string[];
  toolsNeeded: string[];
  effortLevel: "Low" | "Medium" | "High";
  allToolsTracked: string[];
}

/**
 * Extract tool names from text description
 */
export function parseToolsFromText(text: string): string[] {
  const tools = new Set<string>();
  const patterns = [
    { pattern: /\b(bash|shell|command|exec)\b/gi, tool: "bash" },
    { pattern: /\b(git|version control)\b/gi, tool: "git" },
    { pattern: /\b(file|files|filesystem|editor|write)\b/gi, tool: "files" },
    { pattern: /\b(browser|screenshot|navigate|puppeteer)\b/gi, tool: "browser" },
    { pattern: /\b(curl|http|api|fetch|request)\b/gi, tool: "http" },
    { pattern: /\b(docker|container)\b/gi, tool: "docker" },
    { pattern: /\b(database|db|sql|postgres|mysql)\b/gi, tool: "database" },
    { pattern: /\b(json|yaml|parse|serialize)\b/gi, tool: "json" },
    { pattern: /\b(node|npm|typescript|ts|jsx|tsx)\b/gi, tool: "node" },
    { pattern: /\b(python|pip|pytest|py)\b/gi, tool: "python" },
  ];

  for (const { pattern, tool } of patterns) {
    if (pattern.test(text)) {
      tools.add(tool);
    }
  }

  return Array.from(tools);
}

/**
 * Extract file patterns from interview response
 */
export function parseFileContexts(text: string): string[] {
  const contexts = new Set<string>();

  // Look for file extension patterns
  const extensionMatch = text.match(/\*\.([a-z0-9]+)/gi);
  if (extensionMatch) {
    extensionMatch.forEach((ext) => contexts.add(ext));
  }

  // Look for directory patterns
  const dirPatterns = [/(src|lib|test|dist|build|config)\/\*\*?/gi];
  for (const pattern of dirPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      contexts.add(match[0]);
    }
  }

  // Extract from keywords
  const lower = text.toLowerCase();
  if (lower.includes("typescript") || lower.includes(".ts")) contexts.add("*.ts");
  if (lower.includes("javascript") || lower.includes(".js")) contexts.add("*.js");
  if (lower.includes("python") || lower.includes(".py")) contexts.add("*.py");
  if (lower.includes("config")) contexts.add("config/**");
  if (lower.includes("test")) contexts.add("test/**");
  if (lower.includes("src")) contexts.add("src/**");

  return Array.from(contexts);
}

/**
 * Extract skill name from problem description (convert to kebab-case)
 */
export function extractSkillName(text: string): string {
  // Try to find existing kebab-case identifier
  const match = text.match(/([a-z0-9]+-[a-z0-9-]*)/i);
  if (match) {
    return match[1].toLowerCase();
  }

  // Convert first 40 chars to kebab-case
  const slug = text
    .slice(0, 40)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .join("-");

  return slug || "new-skill";
}

/**
 * Parse effort level from response text
 */
export function parseEffortLevel(text: string): "Low" | "Medium" | "High" {
  const lower = text.toLowerCase();
  if (/\blow\b/.test(lower)) return "Low";
  if (/\bhigh\b/.test(lower)) return "High";
  return "Medium";
}

/**
 * Generate SKILL.md markdown content
 */
export function generateSkillMarkdown(result: SkillCreationResult): string {
  const frontmatter: SkillFrontmatter = {
    name: result.skillName,
    description: result.description,
    context: "inline",
    "allowed-tools":
      result.allToolsTracked.length > 0 ? result.allToolsTracked : undefined,
    effort: result.effortLevel,
    when_to_use: `Use when ${result.problem.toLowerCase()}`,
  };

  // Build YAML frontmatter
  let yaml = "---\n";
  yaml += `name: ${frontmatter.name}\n`;
  yaml += `description: ${frontmatter.description}\n`;
  if (frontmatter.context) yaml += `context: ${frontmatter.context}\n`;
  if (frontmatter["allowed-tools"]?.length) {
    yaml += "allowed-tools:\n";
    for (const tool of frontmatter["allowed-tools"]) {
      yaml += `  - ${tool}\n`;
    }
  }
  if (frontmatter.effort) yaml += `effort: ${frontmatter.effort}\n`;
  if (frontmatter.when_to_use)
    yaml += `when_to_use: "${frontmatter.when_to_use}"\n`;
  yaml += "---\n\n";

  // Build markdown content
  const title = result.skillName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  let markdown = `# ${title}\n\n`;
  markdown += `${result.description}\n\n`;

  markdown += `## When to Use\n\n`;
  markdown += `${result.problem}\n\n`;

  markdown += `## File Contexts\n\n`;
  if (result.filesContexts.length > 0) {
    markdown += `Operates on:\n${result.filesContexts.map((ctx) => `- ${ctx}`).join("\n")}\n\n`;
  } else {
    markdown += `General purpose - not file-specific\n\n`;
  }

  markdown += `## Tools Required\n\n`;
  if (result.toolsNeeded.length > 0) {
    markdown += `Needs: ${result.toolsNeeded.join(", ")}\n\n`;
  } else {
    markdown += `No specific external tools required\n\n`;
  }

  markdown += `## How It Works\n\n`;
  markdown += `This skill helps with the following workflow:\n\n`;
  markdown += `1. **Input**: Receive requirements and context\n`;
  markdown += `2. **Process**: Execute the skill steps\n`;
  markdown += `3. **Output**: Deliver results\n\n`;

  markdown += `## Success Criteria\n\n`;
  markdown += `The skill succeeds when:\n`;
  markdown += `- Problem is solved correctly\n`;
  markdown += `- Results meet expectations\n`;
  markdown += `- Process was efficient\n\n`;

  markdown += `## Example Usage\n\n`;
  markdown += `Use this skill by invoking:\n`;
  markdown += `\`\`\`\n/${result.skillName}\n\`\`\`\n\n`;

  markdown += `Or reference it in instructions for Claude.\n`;

  return yaml + markdown;
}

/**
 * Format frontmatter for user review
 */
export function formatFrontmatterPreview(result: SkillCreationResult): string {
  let preview = "```yaml\n---\n";
  preview += `name: ${result.skillName}\n`;
  preview += `description: ${result.description}\n`;
  preview += `context: inline\n`;
  if (result.allToolsTracked.length > 0) {
    preview += `allowed-tools:\n`;
    for (const tool of result.allToolsTracked) {
      preview += `  - ${tool}\n`;
    }
  }
  preview += `effort: ${result.effortLevel}\n`;
  preview += `when_to_use: "Use when ${result.problem.toLowerCase()}"\n`;
  preview += "---\n```";
  return preview;
}

/**
 * Save generated skill to filesystem
 */
export function saveSkillToFilesystem(
  result: SkillCreationResult,
  basePath: string = ".ryft/skills",
): string {
  try {
    // Create directory structure
    const skillDir = join(basePath, result.skillName);
    if (!existsSync(skillDir)) {
      mkdirSync(skillDir, { recursive: true });
    }

    // Generate markdown content
    const markdown = generateSkillMarkdown(result);

    // Write SKILL.md
    const skillFile = join(skillDir, "SKILL.md");
    writeFileSync(skillFile, markdown, "utf8");

    log.info("Skill saved successfully", {
      skillName: result.skillName,
      path: skillFile,
      size: markdown.length,
      effort: result.effortLevel,
    });

    return skillFile;
  } catch (error) {
    log.error("Error saving skill", error instanceof Error ? error : new Error(String(error)));
    throw new Error(
      `Failed to save skill: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Create skill from raw structured input (3 interview responses)
 */
export function createSkillFromResponses(
  problem: string,
  scopeAndTools: string,
  effortResponse: string,
): SkillCreationResult {
  const toolsFromProblem = parseToolsFromText(problem);
  const toolsFromScope = parseToolsFromText(scopeAndTools);
  const allTools = Array.from(new Set([...toolsFromProblem, ...toolsFromScope]));

  const filesContexts = parseFileContexts(scopeAndTools);
  const skillName = extractSkillName(problem);
  const description = problem.split("\n")[0].slice(0, 100).trim();
  const effort = parseEffortLevel(effortResponse);

  return {
    skillName,
    description,
    problem: problem.trim(),
    filesContexts,
    toolsNeeded: allTools,
    effortLevel: effort,
    allToolsTracked: allTools,
  };
}
