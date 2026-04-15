/**
 * Built-in File Reading Tools
 *
 * Provides basic file operations for skills and models that need to analyze code.
 * These tools are always available (unlike MCP tools which require external processes).
 */

import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { stat } from "node:fs/promises";

/**
 * Read a file and return its contents
 *
 * @param filePath - Path to file (relative to cwd or absolute)
 * @param maxBytes - Maximum bytes to read (default 100KB)
 * @returns File contents or error
 *
 * @example
 * const content = await readText("src/cli.ts");
 * // Returns file content as string
 */
export async function readText(
  filePath: string,
  maxBytes: number = 102400,
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const absolutePath = resolve(filePath);
    const fileStats = await stat(absolutePath);

    if (fileStats.isDirectory()) {
      return {
        success: false,
        error: `Path is a directory, not a file: ${filePath}`,
      };
    }

    if (fileStats.size > maxBytes) {
      return {
        success: false,
        error: `File too large: ${fileStats.size} bytes (max ${maxBytes})`,
      };
    }

    const content = await readFile(absolutePath, "utf-8");
    return { success: true, content };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * List files in a directory
 *
 * @param dirPath - Path to directory (relative to cwd or absolute)
 * @param maxItems - Maximum items to return (default 1000)
 * @returns List of file/directory names
 *
 * @example
 * const files = await listDir("src");
 * // Returns ["cli.ts", "modes/", "tools/", ...]
 */
export async function listDir(
  dirPath: string,
  maxItems: number = 1000,
): Promise<{
  success: boolean;
  files?: string[];
  directories?: string[];
  error?: string;
}> {
  try {
    const absolutePath = resolve(dirPath);
    const entries = await readdir(absolutePath, { withFileTypes: true });

    if (entries.length > maxItems) {
      return {
        success: false,
        error: `Too many items: ${entries.length} (max ${maxItems})`,
      };
    }

    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort();
    const directories = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    return { success: true, files, directories };
  } catch (error) {
    return {
      success: false,
      error: `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Read multiple files matching a pattern
 *
 * WARNING: This is a simplified version that reads by exact path list,
 * not by glob pattern. For glob support, use CLI tools (find, grep).
 *
 * @param filePaths - Array of file paths to read
 * @param maxBytesPerFile - Maximum bytes per file (default 50KB)
 * @returns Map of path -> content
 *
 * @example
 * const files = await readMultiple(["package.json", "README.md"]);
 * // Returns { "package.json": "...", "README.md": "..." }
 */
export async function readMultiple(
  filePaths: string[],
  maxBytesPerFile: number = 51200,
): Promise<{
  success: boolean;
  files?: Record<string, string>;
  errors?: Record<string, string>;
}> {
  const files: Record<string, string> = {};
  const errors: Record<string, string> = {};

  for (const filePath of filePaths) {
    const result = await readText(filePath, maxBytesPerFile);
    if (result.success && result.content) {
      files[filePath] = result.content;
    } else {
      errors[filePath] = result.error || "Unknown error";
    }
  }

  return { success: Object.keys(errors).length === 0, files, errors };
}

/**
 * Get file metadata (size, type)
 *
 * @param filePath - Path to file
 * @returns Metadata: isFile, isDirectory, size, path
 *
 * @example
 * const meta = await getFileInfo("src/cli.ts");
 * // Returns { isFile: true, size: 12345, path: "/path/to/src/cli.ts" }
 */
export async function getFileInfo(filePath: string): Promise<{
  success: boolean;
  isFile?: boolean;
  isDirectory?: boolean;
  size?: number;
  path?: string;
  error?: string;
}> {
  try {
    const absolutePath = resolve(filePath);
    const stats = await stat(absolutePath);

    return {
      success: true,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      path: absolutePath,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get file info: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Export as object for potential tool registration
 */
export const FileReaderTools = {
  readText,
  listDir,
  readMultiple,
  getFileInfo,
};
