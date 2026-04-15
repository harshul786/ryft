#!/usr/bin/env node
/**
 * Directory Tree Tool for Ryft
 * Generates a tree-like view of directory structure (like `tree` command)
 * Can be called by skills to show codebase structure to the model
 */

import { readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

interface TreeOptions {
  maxDepth?: number;
  ignorePatterns?: string[];
  sortByType?: boolean;
  showSize?: boolean;
  maxFiles?: number;
}

/**
 * Generate a tree view of a directory structure
 * Similar to: `tree <dir> -I 'node_modules|.git' -L 3`
 */
export function generateDirectoryTree(
  rootPath: string,
  options: TreeOptions = {},
): string {
  const {
    maxDepth = 3,
    ignorePatterns = ["node_modules", ".git", "dist", ".next", "build"],
    sortByType = true,
    showSize = false,
    maxFiles = 500,
  } = options;

  const lines: string[] = [rootPath];
  let fileCount = 0;

  function shouldIgnore(name: string): boolean {
    return ignorePatterns.some(
      (pattern) =>
        name === pattern ||
        name.match(
          new RegExp(pattern.replace(/\./g, "\\.").replace(/\*/g, ".*")),
        ),
    );
  }

  function traverse(dir: string, prefix: string = "", depth: number = 0) {
    if (depth > maxDepth || fileCount > maxFiles) return;

    try {
      const entries = readdirSync(dir, { withFileTypes: true })
        .filter((e) => !shouldIgnore(e.name))
        .sort((a, b) => {
          if (sortByType) {
            const aIsDir = a.isDirectory();
            const bIsDir = b.isDirectory();
            if (aIsDir !== bIsDir) return bIsDir ? 1 : -1;
          }
          return a.name.localeCompare(b.name);
        });

      entries.forEach((entry, index) => {
        fileCount++;
        if (fileCount > maxFiles) return;

        const isLast = index === entries.length - 1;
        const currentPrefix = isLast ? "└── " : "├── ";
        const nextPrefix = isLast ? "    " : "│   ";
        const fullPath = join(dir, entry.name);

        let line = prefix + currentPrefix + entry.name;

        if (entry.isDirectory()) {
          line += "/";
          lines.push(line);
          traverse(fullPath, prefix + nextPrefix, depth + 1);
        } else if (showSize) {
          const size = statSync(fullPath).size;
          const sizeStr =
            size > 1024 * 1024
              ? `${(size / (1024 * 1024)).toFixed(1)}M`
              : size > 1024
                ? `${(size / 1024).toFixed(1)}K`
                : `${size}B`;
          line += ` (${sizeStr})`;
          lines.push(line);
        } else {
          lines.push(line);
        }
      });
    } catch (error) {
      lines.push(`${prefix}[Error reading directory]`);
    }
  }

  traverse(rootPath);
  return lines.join("\n");
}

/**
 * Alternative: List files in a structured format for analysis
 * More suitable for LLM consumption than ASCII tree
 */
export function generateFileList(
  rootPath: string,
  options: TreeOptions = {},
): string {
  const {
    maxDepth = 3,
    ignorePatterns = ["node_modules", ".git", "dist"],
  } = options;

  const files: Array<{ path: string; type: string; depth: number }> = [];

  function shouldIgnore(name: string): boolean {
    return ignorePatterns.some(
      (pattern) =>
        name === pattern ||
        name.match(
          new RegExp(pattern.replace(/\./g, "\\.").replace(/\*/g, ".*")),
        ),
    );
  }

  function traverse(dir: string, depth: number = 0) {
    if (depth > maxDepth) return;

    try {
      const entries = readdirSync(dir, { withFileTypes: true }).filter(
        (e) => !shouldIgnore(e.name),
      );

      entries.forEach((entry) => {
        const fullPath = join(dir, entry.name);
        const relPath = relative(rootPath, fullPath);

        files.push({
          path: relPath,
          type: entry.isDirectory() ? "directory" : "file",
          depth,
        });

        if (entry.isDirectory() && depth < maxDepth) {
          traverse(fullPath, depth + 1);
        }
      });
    } catch (error) {
      // Silently skip unreadable directories
    }
  }

  traverse(rootPath);

  // Group by directory and format for analysis
  const byDir: { [key: string]: string[] } = {};
  files
    .filter((f) => f.type === "file")
    .forEach((f) => {
      const dir = f.path.split("/").slice(0, -1).join("/") || ".";
      if (!byDir[dir]) byDir[dir] = [];
      byDir[dir].push(f.path);
    });

  let output = `# Project Structure\n\n`;
  Object.keys(byDir)
    .sort()
    .forEach((dir) => {
      output += `## ${dir || "Root"}\n`;
      byDir[dir].forEach((file) => {
        output += `- ${file}\n`;
      });
      output += "\n";
    });

  return output;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2] || process.cwd();

  if (!existsSync(path)) {
    console.error(`Path not found: ${path}`);
    process.exit(1);
  }

  const format = process.argv[3] || "tree";

  if (format === "tree") {
    console.log(generateDirectoryTree(path));
  } else if (format === "list") {
    console.log(generateFileList(path));
  } else {
    console.error(`Unknown format: ${format}`);
    process.exit(1);
  }
}

export default { generateDirectoryTree, generateFileList };
