/**
 * Built-in Tools Registry
 *
 * Registers tools that are always available, without requiring MCP servers.
 * These tools support core workflows like file reading for documentation generation.
 */

import type { ToolRegistry } from "./tool-registry.ts";
import type { ToolSchema, CompressedToolSchema } from "./protocol.ts";
import {
  readText,
  listDir,
  readMultiple,
  getFileInfo,
} from "../tools/fileReader.ts";
import { getFeatureLogger } from "../logging/index.ts";

const log = getFeatureLogger("BuiltinTools");

/**
 * Tool schemas for built-in file reading operations
 */
const BUILTIN_TOOLS: Array<{
  name: string;
  description: string;
  schema: ToolSchema;
  compressed: CompressedToolSchema;
}> = [
  {
    name: "read_text",
    description: "Read a text file and return its contents",
    schema: {
      name: "read_text",
      description: "Read a text file and return its contents (max 100KB)",
      inputSchema: {
        type: "object" as const,
        properties: {
          path: {
            type: "string",
            description: "Path to file (relative or absolute)",
          },
          maxBytes: {
            type: "integer",
            description: "Maximum bytes to read (default 102400)",
          },
        },
        required: ["path"],
      },
    },
    compressed: {
      name: "read_text",
      description:
        "Read a text file (max 100KB). Usage: readText(path: string, maxBytes?: number)",
    },
  },
  {
    name: "list_dir",
    description: "List files and directories in a directory",
    schema: {
      name: "list_dir",
      description: "List files and directories in a directory",
      inputSchema: {
        type: "object" as const,
        properties: {
          path: {
            type: "string",
            description: "Path to directory (relative or absolute)",
          },
          maxItems: {
            type: "integer",
            description: "Maximum items to list (default 1000)",
          },
        },
        required: ["path"],
      },
    },
    compressed: {
      name: "list_dir",
      description:
        "List files/dirs in a directory. Usage: listDir(path: string)",
    },
  },
  {
    name: "read_multiple",
    description: "Read multiple files at once and return their contents",
    schema: {
      name: "read_multiple",
      description: "Read multiple files at once (max 50KB each)",
      inputSchema: {
        type: "object" as const,
        properties: {
          paths: {
            type: "array",
            items: { type: "string" },
            description: "Array of file paths to read",
          },
          maxBytesPerFile: {
            type: "integer",
            description: "Maximum bytes per file (default 51200)",
          },
        },
        required: ["paths"],
      },
    },
    compressed: {
      name: "read_multiple",
      description: "Read multiple files. Usage: readMultiple(paths: string[])",
    },
  },
  {
    name: "get_file_info",
    description: "Get metadata about a file (size, type, path)",
    schema: {
      name: "get_file_info",
      description: "Get file metadata (size, type, path)",
      inputSchema: {
        type: "object" as const,
        properties: {
          path: {
            type: "string",
            description: "Path to file or directory (relative or absolute)",
          },
        },
        required: ["path"],
      },
    },
    compressed: {
      name: "get_file_info",
      description: "Get file info. Usage: getFileInfo(path: string)",
    },
  },
];

/**
 * Register built-in tools with a tool registry
 *
 * @param registry - ToolRegistry to add built-in tools to
 */
export function registerBuiltinTools(registry: ToolRegistry): void {
  try {
    for (const { name, schema, compressed } of BUILTIN_TOOLS) {
      registry.addTool("builtin", "Built-in Tools", schema, compressed);
      log.debug(`Registered built-in tool: ${name}`);
    }
    log.info(`Registered ${BUILTIN_TOOLS.length} built-in tools`);
  } catch (error) {
    log.warn(
      `Failed to register built-in tools: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Execute a built-in tool
 *
 * @param toolName - Name of the tool to execute
 * @param params - Tool parameters
 * @returns Tool result as string (serialized)
 */
export async function executeBuiltinTool(
  toolName: string,
  params: Record<string, unknown>,
): Promise<string> {
  try {
    switch (toolName) {
      case "read_text": {
        const { path, maxBytes } = params as {
          path: string;
          maxBytes?: number;
        };
        const result = await readText(path, maxBytes);
        return JSON.stringify(result, null, 2);
      }

      case "list_dir": {
        const { path, maxItems } = params as {
          path: string;
          maxItems?: number;
        };
        const result = await listDir(path, maxItems);
        return JSON.stringify(result, null, 2);
      }

      case "read_multiple": {
        const { paths, maxBytesPerFile } = params as {
          paths: string[];
          maxBytesPerFile?: number;
        };
        const result = await readMultiple(paths, maxBytesPerFile);
        return JSON.stringify(result, null, 2);
      }

      case "get_file_info": {
        const { path } = params as { path: string };
        const result = await getFileInfo(path);
        return JSON.stringify(result, null, 2);
      }

      default:
        return JSON.stringify({
          success: false,
          error: `Unknown built-in tool: ${toolName}`,
        });
    }
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
