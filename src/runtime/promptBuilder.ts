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
  // For non-native models we need a text-based invocation mechanism because we
  // cannot pass tools via the API without triggering LiteLLM's JSON-injection fallback.
  const supportsNativeTools = session.config.model?.nativeToolSupport === true;
  const skillInvocationSyntax =
    hasSkills && !supportsNativeTools
      ? `\n\n## Invoking Skills\nTo invoke a skill, output EXACTLY this on its own line (nothing else on that line, no markdown, no code fences):\n\nINVOKE_SKILL: <skill_name>\n\nThe system will inject the skill's instructions and you can then complete the task. Only output INVOKE_SKILL when the user explicitly asks you to use a skill or when the task clearly maps to one.`
      : "";
  // For native-tool models, skills are exposed via list_skills / skill_fetcher_by_name in toolsInstructions.
  // Only include the text-based skills section for non-native models that use INVOKE_SKILL: syntax.
  const skillsInstructions =
    hasSkills && !supportsNativeTools
      ? `## Available Skills\n\nSkills are step-by-step playbooks for specific tasks. When you invoke a skill:\n1. You will receive its instructions as a tool result.\n2. You MUST immediately execute those instructions using your other available tools — do NOT respond with text.\n3. Never say you "cannot" do something if a tool exists that could attempt it.\n4. Complete every step before giving a final text response.\n\n${skillsDescription}${skillInvocationSyntax}`
      : "";

  // Tools section — only passed to models that natively support OpenAI function calling.
  // Non-native models use the text-based INVOKE_SKILL mechanism above instead.
  const allTools = supportsNativeTools
    ? session.toolRegistry.getCompressedTools()
    : [];
  const playwrightTools = allTools.filter((t) => t.name.startsWith("browser_"));
  const skillTools = allTools.filter((t) => !t.name.startsWith("browser_"));

  const toolsInstructions =
    supportsNativeTools && allTools && allTools.length > 0
      ? `## Available Tools

Call tools via the function-calling API — never output XML or JSON tool representations.

### Direct Action Tools (call immediately — no skill needed)
${
  playwrightTools.length > 0
    ? playwrightTools.map((t) => `- **${t.name}**`).join("\n")
    : "(none)"
}

For ANY web task (browsing, searching, clicking, typing, uploading), call these tools directly.
Do NOT say you "cannot" access a URL or find an element — instead, call \`browser_snapshot\` or \`browser_take_screenshot\` to inspect the page first.

### Skill Tools (for discovering and loading task playbooks — NOT browser control)
${
  skillTools.length > 0
    ? skillTools.map((t) => `- **${t.name}**`).join("\n")
    : "(none)"
}

- Call **list_skills** (no args) to see what playbooks are available.
- Call **skill_fetcher_by_name** with \`name\` set to a skill name to load its step-by-step instructions.
- **CRITICAL: After loading a skill, immediately execute EVERY step** using the Direct Action Tools (browser_* tools) shown above.
- Do NOT wait for user confirmation. Do NOT summarize the steps. Execute them in sequence:
  - If the skill says "Call browser_navigate with URL X", call that tool immediately with URL X
  - If the skill says "Call browser_evaluate with JavaScript code", call that tool with that code
  - Continue through all steps sequentially until complete
- Return the final results to the user once all skill steps are executed.`
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
