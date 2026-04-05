import type { ToolSchema, CompressedToolSchema } from "./protocol.ts";

// TODO #17: Implement tool schema compression
// Compresses full MCP tool schemas to lightweight versions for prompt context

/**
 * Compress a full tool schema for LLM prompt inclusion
 * Removes verbose descriptions, examples, output schemas, and nested complexity
 */
export function compressToolSchema(tool: ToolSchema): CompressedToolSchema {
  // Keep only first sentence of description
  const description = tool.description
    .split(/[.!?]/)[0] // First sentence
    .trim()
    .substring(0, 100); // Max 100 chars

  // Compress input schema: keep only essential fields
  let compressed: CompressedToolSchema = {
    name: tool.name,
    description,
  };

  if (tool.inputSchema) {
    compressed.inputSchema = {
      type: tool.inputSchema.type,
      required: tool.inputSchema.required,
    };

    // Only include properties with descriptions, limit to 3 top-level fields
    if (tool.inputSchema.properties) {
      const properties: Record<string, { type: string; description?: string }> =
        {};
      const keys = Object.keys(tool.inputSchema.properties).slice(0, 3);

      for (const key of keys) {
        const prop = tool.inputSchema.properties[key] as any;
        properties[key] = {
          type: prop.type || "string",
          description: prop.description
            ? prop.description.substring(0, 50)
            : undefined,
        };
      }

      if (Object.keys(properties).length > 0) {
        compressed.inputSchema.properties = properties;
      }
    }
  }

  return compressed;
}

/**
 * Compress multiple tool schemas
 */
export function compressToolSchemas(
  tools: ToolSchema[],
): CompressedToolSchema[] {
  return tools.map(compressToolSchema);
}

/**
 * Estimate token count for a tool schema in prompt
 * Uses rough approximation: ~1token per 4 characters
 */
export function estimateToolSchemaTokens(tool: CompressedToolSchema): number {
  const json = JSON.stringify(tool);
  return Math.ceil(json.length / 4);
}

/**
 * Estimate total tokens for all tools
 */
export function estimateTotalToolTokens(tools: CompressedToolSchema[]): number {
  return tools.reduce(
    (total, tool) => total + estimateToolSchemaTokens(tool),
    0,
  );
}

/**
 * Format compressed tools for inclusion in system prompt
 */
export function formatToolsForPrompt(tools: CompressedToolSchema[]): string {
  if (tools.length === 0) {
    return "";
  }

  const lines = ["## Available Tools", ""];

  for (const tool of tools) {
    lines.push(`### ${tool.name}`);
    lines.push(tool.description);

    if (tool.inputSchema?.properties) {
      lines.push("");
      lines.push("**Parameters:**");
      for (const [name, prop] of Object.entries(tool.inputSchema.properties)) {
        const required = tool.inputSchema.required?.includes(name)
          ? " (required)"
          : "";
        lines.push(
          `- \`${name}\` (${prop.type})${required}: ${prop.description || ""}`,
        );
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Group tools by server for display
 */
export function groupToolsByServer(
  tools: Array<{
    serverId: string;
    serverName: string;
    tool: CompressedToolSchema;
  }>,
): Map<string, CompressedToolSchema[]> {
  const grouped = new Map<string, CompressedToolSchema[]>();

  for (const entry of tools) {
    if (!grouped.has(entry.serverId)) {
      grouped.set(entry.serverId, []);
    }
    grouped.get(entry.serverId)!.push(entry.tool);
  }

  return grouped;
}
