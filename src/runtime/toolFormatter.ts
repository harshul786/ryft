import type { Session } from "./session.ts";

/**
 * Build the OpenAI-compatible function-calling tool list for a session.
 * Returns undefined for models that don't support native tools.
 */
export function buildFormattedTools(session: Session) {
  if (session.config.model?.nativeToolSupport !== true) return undefined;

  const tools = session.toolRegistry.getCompressedTools();
  if (!tools?.length) return undefined;

  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}
