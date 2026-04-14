/**
 * Coder MCP Server
 *
 * Provides real coding tools exposed over JSON-RPC (MCP protocol):
 * - read_file        read a file from disk
 * - write_file       overwrite / create a file
 * - str_replace_in_file  make a precise substring replacement
 * - create_directory create a directory (and parents)
 * - list_directory   list entries in a directory
 * - delete_file      delete a file
 * - bash             run a shell command and capture output
 *
 * Features:
 * - File state tracking (mtime/hash detection)
 * - Permission rules enforcement  
 * - Syntax validation before writes
 * - Structured error responses
 */

import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  unlink,
  stat,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { fileState } from "../utils/fileState";
import {
  loadPermissionRules,
  canRead,
  canWrite,
  canDelete,
  canBash,
  type PermissionRules,
} from "../config/permissions";
import { validateFile } from "../tools/syntaxValidator";

const execAsync = promisify(exec);
const CWD = process.cwd();

// Initialize permission rules (can be overridden via environment or config)
let permissionRules = loadPermissionRules({
  strictMode: process.env.RYFT_STRICT_MODE === "true",
});

// Load permission config from environment if available
function initializePermissionsFromEnv(): void {
  try {
    // Check for RYFT_PERMISSIONS_JSON which contains stringified config
    if (process.env.RYFT_PERMISSIONS_JSON) {
      const config = JSON.parse(process.env.RYFT_PERMISSIONS_JSON);
      permissionRules = loadPermissionRules(config);
    } else {
      // Use defaults but check for strict mode flag
      permissionRules = loadPermissionRules({
        strictMode: process.env.RYFT_STRICT_MODE === "true",
      });
    }
  } catch (error) {
    // Fall back to defaults if parsing fails
    console.error(
      `Failed to load permissions from environment: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "read_file",
    description: "Read the entire contents of a file.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative or absolute path to the file.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write (create or overwrite) a file with the given content.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative or absolute path to the file.",
        },
        content: {
          type: "string",
          description: "Full content to write to the file.",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "str_replace_in_file",
    description:
      "Replace a unique substring in a file with a new string. Fails if the old_str matches zero or more than one location.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative or absolute path to the file.",
        },
        old_str: {
          type: "string",
          description: "The exact text to replace (must appear exactly once).",
        },
        new_str: {
          type: "string",
          description: "The replacement text.",
        },
      },
      required: ["path", "old_str", "new_str"],
    },
  },
  {
    name: "create_directory",
    description: "Create a directory (and any missing parent directories).",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative or absolute path to the directory.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "list_directory",
    description: "List entries inside a directory.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative or absolute path to the directory.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "delete_file",
    description: "Delete a file from disk.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative or absolute path to the file.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "bash",
    description:
      "Run a shell command in the current working directory and return its combined stdout/stderr (max 50 000 chars).",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Shell command to execute.",
        },
        timeout_ms: {
          type: "number",
          description: "Optional timeout in milliseconds (default 30 000).",
        },
      },
      required: ["command"],
    },
  },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolvePath(p: string): string {
  return resolve(CWD, p);
}

/**
 * Set new permission rules (for runtime configuration)
 */
export function setCoderPermissions(rules: PermissionRules): void {
  permissionRules = rules;
}

/**
 * Get current permission rules
 */
export function getCoderPermissions(): PermissionRules {
  return permissionRules;
}

/**
 * Clear the file state cache
 */
export function clearCoderFileState(): void {
  fileState.clear();
}

// ── Tool handlers ─────────────────────────────────────────────────────────────

async function handleReadFile(args: Record<string, unknown>): Promise<string> {
  const filePath = resolvePath(args.path as string);
  
  // Check read permissions
  const readPerm = canRead(filePath, permissionRules);
  if (!readPerm.allowed) {
    throw new Error(
      `Read denied: ${readPerm.reason}. Path: ${filePath}`
    );
  }

  const content = await readFile(filePath, "utf-8");
  
  // Record file state after read for conflict detection
  await fileState.recordRead(filePath);
  
  return content;
}

async function handleWriteFile(args: Record<string, unknown>): Promise<string> {
  const filePath = resolvePath(args.path as string);
  const content = args.content as string;

  // Check write permissions
  const writePerm = canWrite(filePath, permissionRules);
  if (!writePerm.allowed) {
    throw new Error(
      `Write denied: ${writePerm.reason}. Path: ${filePath}`
    );
  }

  // Check if file was modified since last read
  const isModified = await fileState.checkModified(filePath);
  if (isModified) {
    throw new Error(
      `Write rejected: ${filePath} has been modified since last read. ` +
      `Run read_file again to get the latest version before writing.`
    );
  }

  // Validate syntax if applicable
  const validation = await validateFile(filePath, content);
  if (!validation.isValid && validation.errors.length > 0) {
    const errorList = validation.errors
      .map(
        (e) =>
          `Line ${e.line}: ${e.message}`
      )
      .join("\n");
    throw new Error(
      `Syntax validation failed for ${filePath} (${validation.language}):\n${errorList}`
    );
  }

  // Ensure parent directory exists
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  if (dir) await mkdir(dir, { recursive: true });
  await writeFile(filePath, content, "utf-8");

  // Record successful write
  await fileState.recordWrite(filePath);

  // Warn about any validation warnings
  let message = `Written ${content.length} characters to ${filePath}`;
  if (validation.warnings && validation.warnings.length > 0) {
    const warnings = validation.warnings
      .map((w) => `Line ${w.line}: ${w.message}`)
      .join("\n");
    message += `\n⚠️  Validation warnings (${validation.language}):\n${warnings}`;
  }

  return message;
}

async function handleStrReplaceInFile(
  args: Record<string, unknown>,
): Promise<string> {
  const filePath = resolvePath(args.path as string);
  const oldStr = args.old_str as string;
  const newStr = args.new_str as string;

  // Check write permissions
  const writePerm = canWrite(filePath, permissionRules);
  if (!writePerm.allowed) {
    throw new Error(
      `Write denied: ${writePerm.reason}. Path: ${filePath}`
    );
  }

  // Check if file was modified since last read
  const isModified = await fileState.checkModified(filePath);
  if (isModified) {
    throw new Error(
      `Write rejected: ${filePath} has been modified since last read. ` +
      `Run read_file again to get the latest version before writing.`
    );
  }

  const original = await readFile(filePath, "utf-8");

  const occurrences = original.split(oldStr).length - 1;
  if (occurrences === 0) {
    throw new Error(`old_str not found in ${filePath}`);
  }
  if (occurrences > 1) {
    throw new Error(
      `old_str matches ${occurrences} locations in ${filePath} — provide more context to make it unique`,
    );
  }

  const updated = original.replace(oldStr, newStr);

  // Validate syntax of updated content
  const validation = await validateFile(filePath, updated);
  if (!validation.isValid && validation.errors.length > 0) {
    const errorList = validation.errors
      .map(
        (e) =>
          `Line ${e.line}: ${e.message}`
      )
      .join("\n");
    throw new Error(
      `Syntax validation failed for ${filePath} (${validation.language}):\n${errorList}`
    );
  }

  await writeFile(filePath, updated, "utf-8");

  // Record successful write
  await fileState.recordWrite(filePath);

  let message = `Replaced 1 occurrence in ${filePath}`;
  if (validation.warnings && validation.warnings.length > 0) {
    const warnings = validation.warnings
      .map((w) => `Line ${w.line}: ${w.message}`)
      .join("\n");
    message += `\n⚠️  Validation warnings (${validation.language}):\n${warnings}`;
  }

  return message;
}

async function handleCreateDirectory(
  args: Record<string, unknown>,
): Promise<string> {
  const dirPath = resolvePath(args.path as string);

  // Check write permissions
  const writePerm = canWrite(dirPath, permissionRules);
  if (!writePerm.allowed) {
    throw new Error(
      `Write denied: ${writePerm.reason}. Path: ${dirPath}`
    );
  }

  await mkdir(dirPath, { recursive: true });
  return `Directory created: ${dirPath}`;
}

async function handleListDirectory(
  args: Record<string, unknown>,
): Promise<string> {
  const dirPath = resolvePath(args.path as string);

  // Check read permissions
  const readPerm = canRead(dirPath, permissionRules);
  if (!readPerm.allowed) {
    throw new Error(
      `Read denied: ${readPerm.reason}. Path: ${dirPath}`
    );
  }

  const entries = await readdir(dirPath, { withFileTypes: true });
  const lines = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
  return lines.join("\n") || "(empty directory)";
}

async function handleDeleteFile(
  args: Record<string, unknown>,
): Promise<string> {
  const filePath = resolvePath(args.path as string);

  // Check delete permissions
  const deletePerm = canDelete(filePath, permissionRules);
  if (!deletePerm.allowed) {
    throw new Error(
      `Delete denied: ${deletePerm.reason}. Path: ${filePath}`
    );
  }

  await unlink(filePath);
  return `Deleted ${filePath}`;
}

async function handleBash(args: Record<string, unknown>): Promise<string> {
  const command = args.command as string;
  const timeoutMs =
    typeof args.timeout_ms === "number" ? args.timeout_ms : 30_000;

  // Check bash permissions
  const bashPerm = canBash(command, permissionRules);
  if (!bashPerm.allowed) {
    throw new Error(
      `Bash command denied: ${bashPerm.reason}. Command: ${command}`
    );
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: CWD,
      timeout: timeoutMs,
      shell: "/bin/sh",
    });
    const combined = [stdout, stderr]
      .filter(Boolean)
      .join("\n")
      .slice(0, 50_000);
    return combined || "(no output)";
  } catch (error: unknown) {
    // execAsync rejects on non-zero exit; include all output in the result
    const execError = error as {
      stdout?: string;
      stderr?: string;
      message: string;
    };
    const out = [execError.stdout, execError.stderr, execError.message]
      .filter(Boolean)
      .join("\n")
      .slice(0, 50_000);
    // Return as an error result so the model knows the command failed
    throw new Error(out);
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "read_file":
      return { type: "text", text: await handleReadFile(args) };
    case "write_file":
      return { type: "text", text: await handleWriteFile(args) };
    case "str_replace_in_file":
      return { type: "text", text: await handleStrReplaceInFile(args) };
    case "create_directory":
      return { type: "text", text: await handleCreateDirectory(args) };
    case "list_directory":
      return { type: "text", text: await handleListDirectory(args) };
    case "delete_file":
      return { type: "text", text: await handleDeleteFile(args) };
    case "bash":
      return { type: "text", text: await handleBash(args) };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── JSON-RPC handler ──────────────────────────────────────────────────────────

async function handleRequest(
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  if (method === "initialize") {
    return {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "ryft-coder",
        version: "1.0.0",
      },
    };
  }

  if (method === "notifications/initialized") {
    return null;
  }

  if (method === "tools/list") {
    return { tools: TOOLS };
  }

  if (method === "tools/call") {
    const name = params.name as string;
    const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;
    if (!name) throw new Error("Missing required parameter: name");
    return dispatchTool(name, toolArgs);
  }

  throw new Error(`Unknown method: ${method}`);
}

// ── Process entry point ───────────────────────────────────────────────────────

export async function runCoderMcpServerProcess(): Promise<void> {
  const readline = await import("readline");

  // Initialize permissions from environment at startup
  initializePermissionsFromEnv();

  // Signal ready to the parent process
  process.stdout.write(JSON.stringify({ type: "ready" }) + "\n");

  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });

  rl.on("line", async (line: string) => {
    let requestId: string | number | undefined;
    try {
      const request = JSON.parse(line) as {
        id?: string | number;
        method: string;
        params?: Record<string, unknown>;
      };
      requestId = request.id;
      const result = await handleRequest(request.method, request.params ?? {});
      process.stdout.write(JSON.stringify({ id: request.id, result }) + "\n");
    } catch (error) {
      process.stdout.write(
        JSON.stringify({
          id: requestId,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : String(error),
          },
        }) + "\n",
      );
    }
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

// Run when executed directly
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.includes("coder-server")
) {
  runCoderMcpServerProcess().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
