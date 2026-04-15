import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { homedir } from "node:os";
import type { MemoryModeName } from "../types.ts";

export interface MemoryContext {
  cwd?: string;
  homeDir?: string;
  sessionSnapshot?: string;
}

const MAX_MEMORY_FILE_CHARS = 12_000;
const MAX_MEMORY_SNIPPET_CHARS = 2_200;
function resolveCwd(context: MemoryContext): string {
  return context.cwd ?? process.cwd();
}

function resolveHomeDir(context: MemoryContext): string {
  return context.homeDir ?? homedir();
}

function workspaceKey(cwd: string): string {
  return createHash("sha256")
    .update(path.resolve(cwd))
    .digest("hex")
    .slice(0, 16);
}

function claudeLikePath(context: MemoryContext): string {
  return path.join(
    resolveHomeDir(context),
    ".ryft",
    "memory",
    "normal",
    `${workspaceKey(resolveCwd(context))}.md`,
  );
}

function hierarchyPath(context: MemoryContext): string {
  return path.join(resolveCwd(context), "hierarchy.md");
}

async function readIfExists(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function trimToMaxChars(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }
  return content.slice(content.length - maxChars);
}

function compactText(text: string, maxChars = 160): string {
  const flattened = text.replace(/\s+/g, " ").trim();
  if (flattened.length <= maxChars) {
    return flattened;
  }
  return `${flattened.slice(0, maxChars - 1)}…`;
}

function buildTurnNote(userText: string, assistantText: string): string {
  const lines = [
    `- User: ${compactText(userText)}`,
    `- Assistant: ${compactText(assistantText)}`,
  ];
  return lines.join("\n");
}

function buildClaudelikeTemplate(): string {
  return ["# Ryft Memory", "", "## Decisions", "", "## Recent Notes", ""].join(
    "\n",
  );
}

async function buildHierarchyTree(
  rootDir: string,
  maxDepth = 2,
  depth = 0,
): Promise<string[]> {
  if (depth > maxDepth) {
    return [];
  }

  try {
    const dirEntries = await readdir(rootDir, { withFileTypes: true });
    const entries = dirEntries
      .filter(
        (entry) => !entry.name.startsWith(".") || entry.name === ".claude",
      )
      .filter((entry) => entry.name !== "node_modules" && entry.name !== ".git")
      .map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const lines: string[] = [];
    for (const entry of entries.slice(0, 60)) {
      const prefix = `${"  ".repeat(depth)}- ${entry.name}${entry.isDirectory ? "/" : ""}`;
      lines.push(prefix);
      if (entry.isDirectory) {
        lines.push(
          ...(await buildHierarchyTree(
            path.join(rootDir, entry.name),
            maxDepth,
            depth + 1,
          )),
        );
      }
    }
    return lines;
  } catch {
    return [];
  }
}

async function buildHierarchyTemplate(cwd: string): Promise<string> {
  const tree = await buildHierarchyTree(cwd);
  return [
    "# Hierarchy",
    "",
    "## Tree",
    ...tree,
    "",
    "## Recent Notes",
    "",
  ].join("\n");
}

async function mergeRecentNotes(
  existing: string,
  note: string,
  mode: MemoryModeName,
  cwd: string,
): Promise<string> {
  const trimmed = existing.trim();
  const noteBlock = [`### ${new Date().toISOString()}`, note, ""].join("\n");

  if (!trimmed) {
    return mode === "hierarchy"
      ? (await buildHierarchyTemplate(cwd)).replace(
          /\n## Recent Notes\n\n$/,
          `\n## Recent Notes\n\n${noteBlock}`,
        )
      : `${buildClaudelikeTemplate()}${noteBlock}`;
  }

  if (mode === "hierarchy") {
    const sections = trimmed.split(/\n## Recent Notes\n\n/);
    if (sections.length === 2) {
      return `${sections[0]}\n## Recent Notes\n\n${noteBlock}${sections[1]}`;
    }
    return `${trimmed}\n\n## Recent Notes\n\n${noteBlock}`;
  }

  if (trimmed.includes("## Recent Notes")) {
    const [head, rest] = trimmed.split(/\n## Recent Notes\n\n/, 2);
    return `${head}\n## Recent Notes\n\n${noteBlock}${rest ?? ""}`.trimEnd();
  }

  return `${trimmed}\n\n## Recent Notes\n\n${noteBlock}`.trimEnd();
}

export async function loadMemoryContent(
  memoryMode: MemoryModeName,
  context: MemoryContext = {},
): Promise<string> {
  const cwd = resolveCwd(context);
  if (memoryMode === "session") {
    return trimToMaxChars(
      context.sessionSnapshot ?? "",
      MAX_MEMORY_SNIPPET_CHARS,
    );
  }

  const filePath =
    memoryMode === "normal" ? claudeLikePath(context) : hierarchyPath(context);
  const content = await readIfExists(filePath);
  return trimToMaxChars(content, MAX_MEMORY_SNIPPET_CHARS);
}

export async function recordMemoryTurn(
  memoryMode: MemoryModeName,
  context: MemoryContext,
  userText: string,
  assistantText: string,
): Promise<string> {
  const note = buildTurnNote(userText, assistantText);

  if (memoryMode === "session") {
    const prior = context.sessionSnapshot ?? "";
    const next = [prior.trim(), note].filter(Boolean).join("\n\n");
    return trimToMaxChars(next, MAX_MEMORY_FILE_CHARS);
  }

  const cwd = resolveCwd(context);
  const filePath =
    memoryMode === "normal" ? claudeLikePath(context) : hierarchyPath(context);
  await mkdir(path.dirname(filePath), { recursive: true });
  let existing = await readIfExists(filePath);
  if (!existing.trim()) {
    existing =
      memoryMode === "normal"
        ? buildClaudelikeTemplate()
        : await buildHierarchyTemplate(cwd);
  }

  const updated = await mergeRecentNotes(existing, note, memoryMode, cwd);
  const trimmed = trimToMaxChars(updated, MAX_MEMORY_FILE_CHARS);
  await writeFile(filePath, `${trimmed}\n`, "utf8");
  return trimmed;
}
