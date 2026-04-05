import type { ChatMessage } from "../types.ts";
import {
  BROWSER_SURFF_PROMPT,
  BROWSER_SURFF_SKILL_HINT,
} from "../browser/prompt.ts";
import { buildMemoryPrompt } from "../memory/compose.ts";
import { buildModePrompt } from "../modes/compose.ts";
import { applyTokenCap } from "./tokenBudget.ts";
import type { Session } from "./session.ts";

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

  // Skills section — only include when actual skills are discovered.
  // The string "No skills loaded." is returned when nothing is found; skip it.
  const skillsDescription = await session.describeSkills();
  const hasSkills =
    skillsDescription &&
    skillsDescription !== "No skills loaded." &&
    skillsDescription.trim().length > 0;
  const skillsInstructions = hasSkills
    ? `## Available Skills\n\nYou have access to specialized skills for specific tasks:\n\n${skillsDescription}\n\nUse your judgment about when to invoke a skill that matches the user's request.`
    : "";

  // Tools section — tools are passed to the model via the OpenAI `tools` API
  // parameter (native function-calling), NOT via system-prompt XML instructions.
  // We just tell the model that tools exist; the API handles the rest.
  const allTools = session.toolRegistry.getCompressedTools();
  const toolsInstructions =
    allTools && allTools.length > 0
      ? `## Available Tools

You have ${allTools.length} tool(s) available via the function-calling API: ${allTools.map((t) => t.name).join(", ")}.

IMPORTANT: When you want to use a tool, invoke it through the function-calling interface — DO NOT generate any XML, JSON, or text representation of a tool call. The runtime will handle execution and return results to you automatically.`
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
      "Keep responses concise and prefer simple architectures.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    4000,
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
