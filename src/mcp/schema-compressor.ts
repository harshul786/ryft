import type { ToolSchema, CompressedToolSchema } from "./protocol.ts";
import type { ProviderType } from "../types.ts";

// TODO #17: Implement tool schema compression
// Compresses full MCP tool schemas to lightweight versions for prompt context

/**
 * Provider-specific schema compression.
 * Different LLM providers have different JSON schema validation requirements.
 */
export function compressToolSchemaForProvider(
  tool: ToolSchema,
  provider?: ProviderType,
): CompressedToolSchema {
  switch (provider) {
    case "google":
      return compressToolSchemaForGemini(tool);
    case "ollama":
      return compressToolSchemaForOllama(tool);
    case "anthropic":
      return compressToolSchemaForAnthropic(tool);
    case "openai":
    case "openai-compatible":
    default:
      return compressToolSchemaForOpenAI(tool);
  }
}

/**
 * Gemini (Google) — Requires strict JSON Schema validation.
 * Keep all required schema fields: type, items for arrays, enum, required with validation.
 */
function compressToolSchemaForGemini(tool: ToolSchema): CompressedToolSchema {
  const description = tool.description
    .split(/[.!?]/)[0]
    .trim()
    .substring(0, 100);

  let compressed: CompressedToolSchema = {
    name: tool.name,
    description,
  };

  if (tool.inputSchema) {
    compressed.inputSchema = {
      type: tool.inputSchema.type,
    };

    if (tool.inputSchema.properties) {
      const properties: Record<
        string,
        { type: string; description?: string; items?: any; enum?: any[] }
      > = {};
      const keys = Object.keys(tool.inputSchema.properties).slice(0, 3);

      for (const key of keys) {
        const prop = tool.inputSchema.properties[key] as any;
        const propSchema: any = {
          type: prop.type || "string",
        };

        if (prop.description) {
          propSchema.description = prop.description.substring(0, 50);
        }

        // CRITICAL for Gemini: Always include items for arrays
        if (prop.type === "array" && prop.items) {
          propSchema.items = prop.items;
        }

        // Include enum if present
        if (prop.enum) {
          propSchema.enum = prop.enum;
        }

        properties[key] = propSchema;
      }

      if (Object.keys(properties).length > 0) {
        compressed.inputSchema.properties = properties;
      }

      // Only include required fields that exist in properties
      if (tool.inputSchema.required) {
        const validRequired = tool.inputSchema.required.filter(
          (req) => properties[req],
        );
        if (validRequired.length > 0) {
          compressed.inputSchema.required = validRequired;
        }
      }
    }
  }

  return compressed;
}

/**
 * Ollama — Less strict validation. Can use aggressive compression.
 * Focus on descriptions and basic types, drop complex nested schemas.
 */
function compressToolSchemaForOllama(tool: ToolSchema): CompressedToolSchema {
  const description = tool.description
    .split(/[.!?]/)[0]
    .trim()
    .substring(0, 100);

  let compressed: CompressedToolSchema = {
    name: tool.name,
    description,
  };

  if (tool.inputSchema) {
    compressed.inputSchema = {
      type: tool.inputSchema.type,
    };

    if (tool.inputSchema.properties) {
      const properties: Record<string, { type: string; description?: string }> =
        {};
      const keys = Object.keys(tool.inputSchema.properties).slice(0, 5); // More fields for Ollama

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

      // Don't require exact required field matching for Ollama
      if (tool.inputSchema.required) {
        compressed.inputSchema.required = tool.inputSchema.required;
      }
    }
  }

  return compressed;
}

/**
 * Anthropic (Claude) — Standard JSON Schema support.
 * Balance between Gemini strictness and Ollama laxness.
 */
function compressToolSchemaForAnthropic(
  tool: ToolSchema,
): CompressedToolSchema {
  const description = tool.description
    .split(/[.!?]/)[0]
    .trim()
    .substring(0, 100);

  let compressed: CompressedToolSchema = {
    name: tool.name,
    description,
  };

  if (tool.inputSchema) {
    compressed.inputSchema = {
      type: tool.inputSchema.type,
    };

    if (tool.inputSchema.properties) {
      const properties: Record<
        string,
        { type: string; description?: string; items?: any }
      > = {};
      const keys = Object.keys(tool.inputSchema.properties).slice(0, 4);

      for (const key of keys) {
        const prop = tool.inputSchema.properties[key] as any;
        const propSchema: any = {
          type: prop.type || "string",
        };

        if (prop.description) {
          propSchema.description = prop.description.substring(0, 50);
        }

        // Include items for arrays for safety
        if (prop.type === "array" && prop.items) {
          propSchema.items = prop.items;
        }

        properties[key] = propSchema;
      }

      if (Object.keys(properties).length > 0) {
        compressed.inputSchema.properties = properties;
      }

      if (tool.inputSchema.required) {
        const validRequired = tool.inputSchema.required.filter(
          (req) => properties[req],
        );
        if (validRequired.length > 0) {
          compressed.inputSchema.required = validRequired;
        }
      }
    }
  }

  return compressed;
}

/**
 * OpenAI / OpenAI-compatible — Standard JSON Schema support with flexible validation.
 * Medium compression level.
 */
function compressToolSchemaForOpenAI(tool: ToolSchema): CompressedToolSchema {
  const description = tool.description
    .split(/[.!?]/)[0]
    .trim()
    .substring(0, 100);

  let compressed: CompressedToolSchema = {
    name: tool.name,
    description,
  };

  if (tool.inputSchema) {
    compressed.inputSchema = {
      type: tool.inputSchema.type,
    };

    if (tool.inputSchema.properties) {
      const properties: Record<
        string,
        { type: string; description?: string; items?: any }
      > = {};
      const keys = Object.keys(tool.inputSchema.properties).slice(0, 4);

      for (const key of keys) {
        const prop = tool.inputSchema.properties[key] as any;
        const propSchema: any = {
          type: prop.type || "string",
        };

        if (prop.description) {
          propSchema.description = prop.description.substring(0, 50);
        }

        // Include items for arrays
        if (prop.type === "array" && prop.items) {
          propSchema.items = prop.items;
        }

        properties[key] = propSchema;
      }

      if (Object.keys(properties).length > 0) {
        compressed.inputSchema.properties = properties;
      }

      if (tool.inputSchema.required) {
        const validRequired = tool.inputSchema.required.filter(
          (req) => properties[req],
        );
        if (validRequired.length > 0) {
          compressed.inputSchema.required = validRequired;
        }
      }
    }
  }

  return compressed;
}

/**
 * Compress a full tool schema for LLM prompt inclusion (uses default provider)
 * @deprecated Use compressToolSchemaForProvider instead
 */
export function compressToolSchema(tool: ToolSchema): CompressedToolSchema {
  return compressToolSchemaForProvider(tool, "openai");
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
