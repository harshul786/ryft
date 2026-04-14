import type { Command, CommandContext } from "../../commands.ts";
import {
  saveSkillToFilesystem,
  type SkillInterviewResult,
} from "../../commands/createSkill.ts";
import { streamChatCompletion } from "../../runtime/llmClient.ts";
import type { ChatMessage } from "../../types.ts";
import { getFeatureLogger } from "../../logging/index.ts";

const log = getFeatureLogger("CreateSkillCommand");

/**
 * System prompt for guided skill creation interview
 */
function getSkillCreationSystemPrompt(): string {
  return `# Skill Builder Interview Assistant

You are helping create a new reusable skill for Ryft. Conduct a brief, 3-question interview:

1. "What problem does this skill solve?" — Get a 1-2 sentence problem statement
2. "What files/contexts? What tools?" — Understand scope and dependencies  
3. "Effort level (Low/Medium/High)?" — Estimate complexity

For each answer, parse the response to extract:
- Skill name (from problem description)
- Description (1-line summary)
- Files/contexts mentioned (look for patterns like *.ts, src/*, etc.)
- Tools mentioned (bash, git, files, browser, docker, database, http, etc.)
- Effort level (Low < 5 steps | Medium 5-15 steps | High > 15 steps)

Keep questions concise. After gathering all 3 answers, summarize the skill and ask for confirmation before generation.`;
}

/**
 * Interactive skill creation command
 * Conducts LLM-driven interview to create new skills
 */
export const createSkill: Command = {
  name: "create-skill",
  aliases: ["cs", "skill-create"],
  description: "Create a new skill interactively with LLM guidance",

  async execute(args: string[], context: CommandContext) {
    try {
      log.info("Starting skill creation flow");

      // Show introduction
      const introMessage = `🛠️ **Skill Builder** - Let's create a new skill!

I'll guide you through 3 quick questions to define your skill. You can type **cancel** anytime to stop.

**Round 1 of 3:**
What problem does this skill solve? Describe the use case briefly.`;

      context.setAppState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content: introMessage,
          },
        ],
      }));

      log.info("Skill creation introduction shown");
    } catch (error) {
      log.error("Error initiating skill creation", { error: String(error) });
      context.setAppState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content: `❌ Error starting skill creation: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      }));
    }
  },
};

/**
 * Helper function to parse tool names from text
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
  ];

  for (const { pattern, tool } of patterns) {
    if (pattern.test(text)) {
      tools.add(tool);
    }
  }

  return Array.from(tools);
}

/**
 * Helper to extract skill name from problem description
 */
export function extractSkillNameFromProblem(text: string): string {
  // Try to find a kebab-case identifier
  const match = text.match(/([a-z0-9]+-[a-z0-9-]*)/i);
  if (match) {
    return match[1].toLowerCase();
  }

  // Convert first 30 chars to kebab-case
  const slug = text
    .slice(0, 30)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "new-skill";
}

/**
 * Parse effort level from response
 */
export function parseEffortLevelFromResponse(text: string): "Low" | "Medium" | "High" {
  const lower = text.toLowerCase();
  if (/\blow\b/.test(lower)) return "Low";
  if (/\bhigh\b/.test(lower)) return "High";
  if (/\bmedium\b/.test(lower)) return "Medium";
  return "Medium";
}
