/**
 * Hook for extracting file changes/diffs from recent chat messages.
 * Parses tool results to find file edits and generates diffs on demand.
 */

import { useMemo } from "react";
import type { ChatMessage, ToolResultContentPart } from "../types.ts";
import { diffLines } from "../ui/diff.ts";
import type { DiffHunk } from "../ui/diff.ts";

export interface FileChange {
  path: string;
  before: string;
  after: string;
  hunks: DiffHunk[];
}

/**
 * Extract file changes from a list of chat messages.
 * Safely handles missing or incomplete tool results.
 * Returns empty array if no files were edited.
 */
export function useTurnDiffs(messages: ChatMessage[]): FileChange[] {
  return useMemo(() => {
    const changes: FileChange[] = [];

    if (!messages || messages.length === 0) return changes;

    // Look for the last assistant message and any tool results nearby
    let recentMessages = messages.slice(-10); // Check recent messages

    for (const msg of recentMessages) {
      if (msg.role === "user" && typeof msg.content !== "string") {
        // Check for tool_result parts
        const resultParts = Array.isArray(msg.content)
          ? msg.content.filter(
              (p): p is ToolResultContentPart => p.type === "tool_result",
            )
          : [];

        for (const part of resultParts) {
          // Look for file edit patterns in tool results
          const fileChanges = parseToolResultForFileEdits(part.content);
          changes.push(...fileChanges);
        }
      }
    }

    return changes;
  }, [messages]);
}

/**
 * Parse a tool result string looking for file edit operations.
 * Supports multiple patterns to be resilient to different tool implementations.
 * Returns empty array if no edits detected.
 */
function parseToolResultForFileEdits(resultContent: string): FileChange[] {
  const changes: FileChange[] = [];

  if (!resultContent || typeof resultContent !== "string") return changes;

  // Pattern 1: JSON structure with file, before, after (common format)
  try {
    // Try to find JSON in the result
    const jsonMatches = resultContent.match(/\{[\s\S]*?\}/g);
    if (jsonMatches) {
      for (const jsonStr of jsonMatches) {
        try {
          const obj = JSON.parse(jsonStr);
          if (
            obj.file &&
            obj.before !== undefined &&
            obj.after !== undefined
          ) {
            const hunks = diffLines(obj.before, obj.after);
            changes.push({
              path: obj.file,
              before: obj.before,
              after: obj.after,
              hunks,
            });
          }
        } catch {
          // Not valid JSON, continue
        }
      }
    }
  } catch {
    // Continue to next pattern
  }

  // Pattern 2: Look for "File: path" followed by before/after blocks
  const filePattern = /File:\s*([^\n]+)\n(?:Added:|Created:)?[\s\S]*?```([\s\S]*?)```/gm;
  let match;
  while ((match = filePattern.exec(resultContent)) !== null) {
    const path = match[1]?.trim() || "unknown";
    const content = match[2]?.trim() || "";

    if (content.length > 0) {
      // If we have content, assume it's the new content with minimal context
      changes.push({
        path,
        before: "",
        after: content,
        hunks: diffLines("", content),
      });
    }
  }

  // Pattern 3: Look for structured messages with newline-separated before/after
  const structuredPattern =
    /(?:edited|modified|created|updated)[\s:]*([^\n]+)[\s\S]*?(?:Before|Old|Previous)[\s:]*\n([\s\S]*?)\n(?:After|New)[\s:]*\n([\s\S]*?)(?:\n\n|$)/gim;
  while ((match = structuredPattern.exec(resultContent)) !== null) {
    const path = match[1]?.trim() || "unknown";
    const before = match[2]?.trim() || "";
    const after = match[3]?.trim() || "";

    if (before || after) {
      changes.push({
        path,
        before,
        after,
        hunks: diffLines(before, after),
      });
    }
  }

  return changes;
}

/**
 * Count total changes across all files.
 */
export function countTotalChanges(
  changes: FileChange[],
): { added: number; removed: number; files: number } {
  let added = 0;
  let removed = 0;

  for (const change of changes) {
    for (const hunk of change.hunks) {
      for (const line of hunk.lines) {
        if (line.type === "add") added++;
        else if (line.type === "remove") removed++;
      }
    }
  }

  return { added, removed, files: changes.length };
}
