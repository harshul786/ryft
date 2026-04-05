import type { ChatMessage } from "../types.ts";
import {
  BROWSER_SURFF_PROMPT,
  BROWSER_SURFF_SKILL_HINT,
} from "../browser/prompt.ts";
import { buildMemoryPrompt } from "../memory/compose.ts";
import { buildModePrompt } from "../modes/compose.ts";
import { applyTokenCap } from "./tokenBudget.ts";
import {
  formatToolsForPrompt,
  compressToolSchemas,
} from "../mcp/schema-compressor.ts";
import {
  formatUnifiedCapabilities,
  formatTaskMapping,
} from "../mcp/tool-describer.ts";
import type { Session } from "./session.ts";
import type { Skill } from "../types.ts";

/**
 * Build just the system prompt content (without user/assistant messages)
 * Used by REPL initialization and CLI mode
 */
export async function buildSystemPrompt(session: Session): Promise<string> {
  const browserModeActive = session.modes.some(
    (mode) => mode.name === "browser-surff",
  );
  const memoryPrompt = await buildMemoryPrompt({
    memoryMode: session.memoryMode,
    cwd: session.config.cwd ?? process.cwd(),
    homeDir: session.config.homeDir,
    sessionSnapshot: session.memoryState.snapshot,
  });

  // Get skills for the active modes
  const skillsDescription = await session.describeSkills();

  // Build skills instructions
  const skillsInstructions = skillsDescription
    ? `## Available Skills\n\nYou have access to specialized skills for specific tasks:\n\n${skillsDescription}\n\nYou can invoke skills by referencing them in your response. Use skill invocations to handle specific tasks.`
    : "";

  // Get MCP tools from toolRegistry and add to prompt
  const allTools = session.toolRegistry.getCompressedTools();

  // Build enhanced tool descriptions using tool-describer
  const toolDescriptions =
    allTools && allTools.length > 0
      ? formatUnifiedCapabilities(allTools, [])
      : "";

  // Build task mapping guide
  const taskMapping =
    allTools && allTools.length > 0 ? formatTaskMapping(allTools, []) : "";

  const toolsInstructions =
    allTools && allTools.length > 0
      ? `${toolDescriptions}

${taskMapping}

### Tool Schemas (JSON Reference)

For reference, here are the exact input schemas for each tool:

\`\`\`json
[
${allTools
  .map(
    (tool) => `  {
    "name": "${tool.name}",
    "description": "${tool.description.replace(/"/g, '\\"')}",
    "inputSchema": ${JSON.stringify(tool.inputSchema || {})}
  }`,
  )
  .join(",\n")}
]
\`\`\`

### Invoking Tools by Task

Different tasks call for different tools:

- **To see what skills are available**: Invoke \`list_skills\` to discover available skills
  - Use when: You want to explore what's possible or need a reminder of available options
  - Example: \`<tool_use id="1" name="list_skills" input='{}' />\`

- **To run a specific skill**: Invoke \`invoke_skill\` with the skill name to execute it
  - Use when: You've identified a skill that solves your task or the user asked for a specific skill
  - Example: \`<tool_use id="2" name="invoke_skill" input='{"skill": "compact"}' />\`

### Tool XML Format (Exact Syntax Required)

Each tool invocation uses an XML block with exactly this structure:

\`\`\`xml
<tool_use id="INTEGER" name="TOOL_NAME" input='JSON_STRING' />
\`\`\`

**Components:**
- \`id\`: Unique integer (start at 1, increment for each tool in response)
- \`name\`: Exact tool name from available tools (e.g., "list_skills", "invoke_skill")
- \`input\`: JSON string with tool parameters (must use single quotes around entire JSON)

**Examples of correct format:**

\`\`\`xml
<tool_use id="1" name="list_skills" input='{}' />
<tool_use id="2" name="invoke_skill" input='{"skill": "compact"}' />
<tool_use id="3" name="invoke_skill" input='{"skill": "edit", "input": "some data"}' />
\`\`\`

**Common mistakes to avoid:**

\`\`\`
❌ <tool_use name="list_skills" />              (missing id, input)
❌ <tool_use id=1 name=list_skills input={} />  (wrong quotes, wrong JSON)
❌ Tool name: list_skills                       (plain text, not XML)
\`\`\`

### Tool Usage Flow

1. **Discover tools first** - If unsure what's available, list them:
   - Call: \`<tool_use id="1" name="list_skills" input='{}' />\`
   - I will execute and show results
   - Results show available skills you can invoke

2. **Invoke the appropriate tool** - Once you know what's available:
   - Call: \`<tool_use id="2" name="invoke_skill" input='{"skill": "skillName"}' />\`
   - Replace "skillName" with the actual skill you want to run
   - I will execute and show results

3. **Use results** - Examine the tool output and decide next steps:
   - Tool results are shown in the conversation
   - You can reference them in subsequent tool calls or responses
   - You can invoke multiple tools in a single response

### Tool Invocation Rules & Restrictions

**When invoking tools:**
- Use \`<tool_use>\` XML blocks exactly as shown—no variations
- Place tool invocations anywhere in your response (beginning, middle, or end)
- You can invoke multiple tools in a single response (use unique IDs 1, 2, 3...)
- Input parameters must be valid JSON strings; incorrect JSON will fail execution
- Tool names must match exactly; typos will cause execution to fail

**What I will do:**
- Parse your response for \`<tool_use>\` blocks
- Execute each tool in order with the parameters you provide
- Append the tool results to our conversation
- Use the results to inform my next response

**What happens after tool execution:**
- Tool output is appended to conversation history as \`tool_result\` blocks
- You (the model) can see and reference these results in your reasoning
- This enables multi-turn workflows where tool results inform next steps`
      : "";

  const systemPrompt = applyTokenCap(
    [
      buildModePrompt(session.modes),
      memoryPrompt,
      skillsInstructions,
      toolsInstructions,
      ...(browserModeActive
        ? [BROWSER_SURFF_PROMPT, BROWSER_SURFF_SKILL_HINT]
        : []),
      "Keep responses concise, use tools sparingly, and prefer simple architectures.",
    ].join("\n\n"),
    2000,
  );

  return systemPrompt;
}

export async function promptWithSession(
  session: Session,
  userText: string,
): Promise<ChatMessage[]> {
  const systemPrompt = await buildSystemPrompt(session);

  return [
    { role: "system", content: systemPrompt },
    ...session.history,
    { role: "user", content: userText },
  ];
}
