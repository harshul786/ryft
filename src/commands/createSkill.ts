/**
 * Create Skill Command
 *
 * Interactive LLM-assisted skill creation with 3-round interview:
 * 1. "What problem does this skill solve?"
 * 2. "What files/contexts? What tools needed?"
 * 3. "Effort level? Generate SKILL.md"
 *
 * Tracks tool usage during interview and auto-fills allowed-tools.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { streamChatCompletion } from "../runtime/llmClient.ts";
import type { Session } from "../runtime/session.ts";
import type { ChatMessage } from "../types.ts";
import { getFeatureLogger } from "../logging/index.ts";

const log = getFeatureLogger("CreateSkill");

/**
 * Response from a single interview round
 */
export interface InterviewRoundResponse {
  round: number;
  question: string;
  answer: string;
  toolsUsed: string[];
}

/**
 * Complete interview result
 */
export interface SkillInterviewResult {
  skillName: string;
  description: string;
  problem: string;
  filesContexts: string[];
  toolsNeeded: string[];
  effortLevel: "Low" | "Medium" | "High";
  rounds: InterviewRoundResponse[];
  allToolsTracked: string[];
}

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
 * System prompt for the skill builder interview
 */
function getSkillBuilderSystemPrompt(): string {
  return `# Skill Builder Interview Assistant

You are helping a user create a new reusable skill for Ryft, an AI coding assistant.

Your job is to conduct a 3-round interview to gather skill requirements:

## Round 1: Problem Statement
Ask the user: "What problem does this skill solve?"
Expected answer: A clear description of the use case and benefit

## Round 2: Scope & Tools
Ask the user: "What files or contexts does it operate on? What tools or capabilities does it need?"
Expected answer: File patterns, tool dependencies (bash, git, files, etc.)

## Round 3: Effort Estimation
Ask the user: "What's the effort level to execute this skill? Choose: Low (< 5 steps) | Medium (5-15 steps) | High (> 15 steps)"
Expected answer: One of: Low, Medium, High

## After Interview (Skill Creation)
When you have all three responses, generate a SKILL.md entry with YAML frontmatter and content.

## Format Guidelines

The generated SKILL.md must follow this exact YAML structure:
\`\`\`yaml
---
name: skill-name                    # kebab-case identifier
description: One-line description   # What this skill does
context: inline                     # inline or fork
allowed-tools:                      # Tools this skill needs
  - tool1
  - tool2
effort: Medium                      # Low | Medium | High
when_to_use: "Use when..."         # When Claude should invoke this
---
\`\`\`

Then add markdown content with sections:
- **# Skill Title** - Clear name
- **## When to Use** - Use cases and examples
- **## How It Works** - Step-by-step process
- **## Success Criteria** - Definition of "done"

## Best Practices

### Naming
- Use kebab-case: my-skill, not MySkill
- Descriptive but concise
- Avoid generic names

### Tools
- List tools the skill genuinely needs
- Examples: bash, git, files, editor, browser
- Leave empty if no specific restrictions

### Context
- 'inline': For skills needing user steering mid-process
- 'fork': For self-contained, independent tasks

## Important Notes
- Be concise in responses to keep the skill focused
- Ask clarifying follow-ups if answers are unclear
- When you have all 3 rounds, confirm the skill details with the user before generating
- After generation, show the YAML preview for approval before saving`;
}

/**
 * Conduct a single interview round with the LLM
 */
async function conductInterviewRound(
  session: Session,
  roundNum: number,
  conversationHistory: ChatMessage[],
  userInput: string,
): Promise<InterviewRoundResponse> {
  const questions = [
    "What problem does this skill solve? Describe the use case and benefit.",
    "What files or contexts does it operate on? What tools or capabilities does it need?",
    "What's the effort level? Choose: Low (< 5 steps) | Medium (5-15 steps) | High (> 15 steps)",
  ];

  const question = questions[roundNum - 1] || "Continue with skill details";

  // Build conversation with system prompt
  const messages: ChatMessage[] = [
    { role: "system", content: getSkillBuilderSystemPrompt() },
    ...conversationHistory,
    { role: "user", content: userInput },
  ];

  log.info(`Conducting interview round ${roundNum}`, {
    questionLength: question.length,
    userInputLength: userInput.length,
  });

  const chunks: string[] = [];
  
  await streamChatCompletion({
    baseUrl: session.config.baseUrl,
    apiKey: session.config.apiKey,
    anthropicApiKey: session.config.anthropicApiKey,
    geminiApiKey: session.config.geminiApiKey,
    ollamaBaseUrl: session.config.ollamaBaseUrl,
    providerType: session.config.model.providerType,
    model: session.config.model.id,
    messages,
    signal: session.abortController.signal,
    temperature: 0.7,
    onDelta: (chunk) => chunks.push(chunk),
  });

  const answer = chunks.join("").trim();

  // Track tools mentioned in the answer
  const toolsUsed = parseToolsFromText(answer);

  return {
    round: roundNum,
    question,
    answer,
    toolsUsed,
  };
}

/**
 * Extract tool names from interview response
 */
function parseToolsFromText(text: string): string[] {
  const tools = new Set<string>();
  const toolPatterns = [
    /\b(bash|shell|command|exec)\b/gi,
    /\b(git|version control)\b/gi,
    /\b(file|files|filesystem|editor|write)\b/gi,
    /\b(browser|screenshot|navigate)\b/gi,
    /\b(curl|http|api|fetch)\b/gi,
    /\b(docker|container)\b/gi,
    /\b(database|db|sql|postgres|mysql)\b/gi,
    /\b(json|yaml|parse)\b/gi,
  ];

  const toolMap: Record<string, string> = {
    bash: "bash",
    shell: "bash",
    command: "bash",
    exec: "bash",
    git: "git",
    "version control": "git",
    file: "files",
    files: "files",
    filesystem: "files",
    editor: "files",
    write: "files",
    browser: "browser",
    screenshot: "browser",
    navigate: "browser",
    curl: "http",
    http: "http",
    api: "http",
    fetch: "http",
    docker: "docker",
    container: "docker",
    database: "database",
    db: "database",
    sql: "database",
    postgres: "database",
    mysql: "database",
    json: "json",
    yaml: "json",
    parse: "json",
  };

  for (const pattern of toolPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const tool = toolMap[match[0].toLowerCase()];
      if (tool) {
        tools.add(tool);
      }
    }
  }

  return Array.from(tools);
}

/**
 * Parse skill name from response (extract kebab-case identifier)
 */
function extractSkillName(text: string): string {
  // Look for patterns like "skill-name" or "my-skill"
  const match = text.match(/(?:^|\s)([a-z0-9]+-[a-z0-9-]*)/i);
  if (match) {
    return match[1].toLowerCase();
  }
  
  // Fallback: use first 20 chars as slug, convert to kebab-case
  const slug = text
    .slice(0, 50)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  
  return slug || "new-skill";
}

/**
 * Parse effort level from response
 */
function parseEffortLevel(text: string): "Low" | "Medium" | "High" {
  const lower = text.toLowerCase();
  if (lower.includes("low")) return "Low";
  if (lower.includes("high")) return "High";
  if (lower.includes("medium")) return "Medium";
  return "Medium"; // Default
}

/**
 * Generate SKILL.md content from interview results
 */
function generateSkillMarkdown(
  result: SkillInterviewResult,
): string {
  const frontmatter: SkillFrontmatter = {
    name: result.skillName,
    description: result.description,
    context: "inline",
    "allowed-tools": result.allToolsTracked.length > 0 ? result.allToolsTracked : undefined,
    effort: result.effortLevel,
    when_to_use: `Use when ${result.problem.toLowerCase()}`,
  };

  // Build frontmatter
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
  if (frontmatter.when_to_use) yaml += `when_to_use: "${frontmatter.when_to_use}"\n`;
  yaml += "---\n\n";

  // Build markdown content
  const title = result.skillName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  let markdown = `# ${title}\n\n`;
  markdown += `${result.description}\n\n`;
  markdown += `## When to Use\n\n${result.problem}\n\n`;
  markdown += `## Contexts\n\n`;
  if (result.filesContexts.length > 0) {
    markdown += `Operates on:\n${result.filesContexts.map((ctx) => `- ${ctx}`).join("\n")}\n\n`;
  } else {
    markdown += `General purpose\n\n`;
  }
  
  markdown += `## Tools Required\n\n`;
  if (result.toolsNeeded.length > 0) {
    markdown += `Needs: ${result.toolsNeeded.join(", ")}\n\n`;
  } else {
    markdown += `No specific tools required\n\n`;
  }

  markdown += `## How It Works\n\n`;
  markdown += `This skill helps with: ${result.problem}\n\n`;
  markdown += `Process:\n1. Understand the requirement\n2. Apply the skill\n3. Verify results\n\n`;

  markdown += `## Success Criteria\n\n`;
  markdown += `Success means:\n- Problem is solved\n- Results are correct\n- Process was efficient\n\n`;

  return yaml + markdown;
}

/**
 * Format frontmatter for user review
 */
function formatFrontmatterPreview(result: SkillInterviewResult): string {
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
 * Main interview flow - conducts 3-round interview and generates skill
 */
export async function createSkillFromConversation(
  session: Session,
  onUpdate: (message: string) => void,
  onRoundComplete: (round: InterviewRoundResponse) => void,
): Promise<SkillInterviewResult | null> {
  try {
    log.info("Starting skill creation interview");
    
    const conversationHistory: ChatMessage[] = [];
    const rounds: InterviewRoundResponse[] = [];
    const allToolsTracked = new Set<string>();

    onUpdate("Welcome to the Skill Builder! Let's create a new skill together.\n");
    onUpdate(
      "This is a 3-round interview to help define your skill.\n",
    );
    onUpdate("You can cancel anytime by typing 'cancel' or 'quit'.\n\n");

    // ── Round 1: Problem Statement ────────────────────────────────────────
    const question1 = "What problem does this skill solve?";
    onUpdate(`\n📋 Round 1: ${question1}\n`);

    // Prompt for user input (will be provided by REPL context)
    // For now, we return a placeholder indicating we're ready for input
    const round1Input = await getUserInputForInterview();
    if (!round1Input || isUserCancellation(round1Input)) {
      onUpdate("Skill creation cancelled.\n");
      return null;
    }

    const round1 = await conductInterviewRound(
      session,
      1,
      conversationHistory,
      round1Input,
    );
    rounds.push(round1);
    round1.toolsUsed.forEach((t) => allToolsTracked.add(t));
    onRoundComplete(round1);

    conversationHistory.push({ role: "user", content: round1Input });
    conversationHistory.push({ role: "assistant", content: round1.answer });

    onUpdate(`\n✅ Round 1 Complete\n`);
    onUpdate(`Answer: ${round1.answer}\n`);

    // ── Round 2: Scope & Tools ────────────────────────────────────────────
    const question2 =
      "What files or contexts does it operate on? What tools or capabilities does it need?";
    onUpdate(`\n📋 Round 2: ${question2}\n`);

    const round2Input = await getUserInputForInterview();
    if (!round2Input || isUserCancellation(round2Input)) {
      onUpdate("Skill creation cancelled.\n");
      return null;
    }

    const round2 = await conductInterviewRound(
      session,
      2,
      conversationHistory,
      round2Input,
    );
    rounds.push(round2);
    round2.toolsUsed.forEach((t) => allToolsTracked.add(t));
    onRoundComplete(round2);

    conversationHistory.push({ role: "user", content: round2Input });
    conversationHistory.push({ role: "assistant", content: round2.answer });

    onUpdate(`\n✅ Round 2 Complete\n`);
    onUpdate(`Answer: ${round2.answer}\n`);

    // ── Round 3: Effort Estimation ────────────────────────────────────────
    const question3 =
      "What's the effort level to execute this skill? Choose: Low (< 5 steps) | Medium (5-15 steps) | High (> 15 steps)";
    onUpdate(`\n📋 Round 3: ${question3}\n`);

    const round3Input = await getUserInputForInterview();
    if (!round3Input || isUserCancellation(round3Input)) {
      onUpdate("Skill creation cancelled.\n");
      return null;
    }

    const round3 = await conductInterviewRound(
      session,
      3,
      conversationHistory,
      round3Input,
    );
    rounds.push(round3);
    round3.toolsUsed.forEach((t) => allToolsTracked.add(t));
    onRoundComplete(round3);

    onUpdate(`\n✅ Round 3 Complete\n`);
    onUpdate(`Answer: ${round3.answer}\n`);

    // ── Generate Skill ────────────────────────────────────────────────────
    onUpdate("\n🔨 Generating skill definition...\n");

    // Extract structured data from responses
    const skillName = extractSkillName(round1Input);
    const description = round1.answer.split("\n")[0].slice(0, 100);
    const filesContexts = parseFileContexts(round2.answer);
    const toolsNeeded = Array.from(allToolsTracked);
    const effortLevel = parseEffortLevel(round3.answer);

    const result: SkillInterviewResult = {
      skillName,
      description,
      problem: round1.answer,
      filesContexts,
      toolsNeeded,
      effortLevel,
      rounds,
      allToolsTracked: toolsNeeded,
    };

    onUpdate("\n📝 Generated Skill Details:\n");
    onUpdate(formatFrontmatterPreview(result));
    onUpdate("\n\n✅ Skill generation complete!\n");

    return result;
  } catch (error) {
    log.error("Error during interview", { error: String(error) });
    onUpdate(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
    return null;
  }
}

/**
 * Parse file contexts from round 2 response
 */
function parseFileContexts(text: string): string[] {
  const contexts = new Set<string>();
  
  // Look for file patterns
  const patterns = [
    /\/\*\*\/([\w\-\.\/]+)/g, // *.ts, src/**
    /\*\.(ts|js|py|java|rb|go)\b/gi, // *.ts, *.js
    /src\//gi, // src/
    /test\//gi, // test/
    /lib\//gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[0]) {
        contexts.add(match[0]);
      }
    }
  }

  // If no explicit patterns, add generic contexts from keywords
  const lower = text.toLowerCase();
  if (lower.includes("typescript") || lower.includes(".ts")) contexts.add("*.ts");
  if (lower.includes("javascript") || lower.includes(".js")) contexts.add("*.js");
  if (lower.includes("python") || lower.includes(".py")) contexts.add("*.py");
  if (lower.includes("config")) contexts.add("config/**");
  if (lower.includes("test")) contexts.add("test/**");
  if (lower.includes("build") || lower.includes("dist")) contexts.add("dist/**");

  return Array.from(contexts);
}

/**
 * Check if user input is a cancellation command
 */
function isUserCancellation(input: string): boolean {
  const lower = input.toLowerCase().trim();
  return lower === "cancel" || lower === "quit" || lower === "exit";
}

/**
 * Placeholder for getting user input (will be called from REPL context)
 * In real usage, this will be provided via the CommandContext
 */
async function getUserInputForInterview(): Promise<string> {
  // This is a stub - will be replaced by actual user input from REPL
  return ""; // Empty for now - will be filled in by REPL handler
}

/**
 * Save generated skill to filesystem
 */
export function saveSkillToFilesystem(
  result: SkillInterviewResult,
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
    });

    return skillFile;
  } catch (error) {
    log.error("Error saving skill", { error: String(error) });
    throw new Error(
      `Failed to save skill: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Run complete skill creation flow
 */
export async function runSkillCreationFlow(
  session: Session,
  onUpdate: (message: string) => void,
  onRoundComplete: (round: InterviewRoundResponse) => void,
  userResponses: string[], // Pre-provided responses for automation/testing
): Promise<{ result: SkillInterviewResult | null; savedPath?: string }> {
  const result = await createSkillFromConversation(
    session,
    onUpdate,
    onRoundComplete,
  );

  if (!result) {
    return { result: null };
  }

  // Show preview and save
  const savedPath = saveSkillToFilesystem(result);
  
  return {
    result,
    savedPath,
  };
}
