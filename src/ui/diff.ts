/**
 * Diff utilities for terminal-based file edit previews.
 * Pure TypeScript implementation — no external diff library needed.
 */

export interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

/**
 * Simple LCS-based diff algorithm for line-level differences.
 * Returns DiffHunks suitable for terminal display.
 */
export function diffLines(oldText: string, newText: string): DiffHunk[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  const hunks: DiffHunk[] = [];
  const lcs = computeLCS(oldLines, newLines);

  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldStart = oldIdx;
    const newStart = newIdx;
    const lines: DiffLine[] = [];

    // Consume matching lines
    while (oldIdx < oldLines.length && newIdx < newLines.length) {
      if (oldLines[oldIdx] === newLines[newIdx]) {
        lines.push({
          type: "context",
          content: oldLines[oldIdx],
          oldLineNum: oldIdx + 1,
          newLineNum: newIdx + 1,
        });
        oldIdx++;
        newIdx++;
      } else {
        break;
      }
    }

    // If we only matched context, skip this hunk
    if (lines.length > 0 && lines.every((l) => l.type === "context")) {
      if (oldIdx >= oldLines.length && newIdx >= newLines.length) break;
      lines.length = 0;
      oldIdx = oldStart;
      newIdx = newStart;
    }

    // Consume differences
    while (oldIdx < oldLines.length || newIdx < newLines.length) {
      if (
        oldIdx < oldLines.length &&
        (newIdx >= newLines.length || oldLines[oldIdx] !== newLines[newIdx])
      ) {
        lines.push({
          type: "remove",
          content: oldLines[oldIdx],
          oldLineNum: oldIdx + 1,
        });
        oldIdx++;
      } else if (newIdx < newLines.length) {
        lines.push({
          type: "add",
          content: newLines[newIdx],
          newLineNum: newIdx + 1,
        });
        newIdx++;
      } else {
        break;
      }

      // Stop if we hit a matching line
      if (oldIdx < oldLines.length && newIdx < newLines.length) {
        if (oldLines[oldIdx] === newLines[newIdx]) break;
      }
    }

    if (lines.length > 0) {
      hunks.push({
        oldStart: oldStart + 1,
        oldCount: oldIdx - oldStart,
        newStart: newStart + 1,
        newCount: newIdx - newStart,
        lines,
      });
    }
  }

  return hunks;
}

/**
 * Compute Longest Common Subsequence (for reference, not used directly in diffLines above).
 * Kept for potential optimization in future.
 */
function computeLCS(a: string[], b: string[]): number[] {
  const m = a.length;
  const n = b.length;
  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[m];
}

/**
 * Word-level diff for semantic highlighting within lines.
 * Returns text with special markers for added/removed words.
 */
export function diffWords(oldText: string, newText: string): string {
  const oldWords = oldText.match(/\S+|\s+/g) || [];
  const newWords = newText.match(/\S+|\s+/g) || [];

  const lcs = computeWordLCS(oldWords, newWords);
  const alignment = alignWords(oldWords, newWords, lcs);

  let result = "";
  for (const item of alignment) {
    if (item.type === "add") {
      result += `[+${item.content}]`;
    } else if (item.type === "remove") {
      result += `[-${item.content}]`;
    } else {
      result += item.content;
    }
  }

  return result;
}

interface WordAlignment {
  type: "add" | "remove" | "context";
  content: string;
}

function computeWordLCS(a: string[], b: string[]): number[] {
  const m = a.length;
  const n = b.length;
  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[m];
}

function alignWords(
  oldWords: string[],
  newWords: string[],
  _lcs: number[],
): WordAlignment[] {
  const result: WordAlignment[] = [];
  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldWords.length || newIdx < newWords.length) {
    if (oldIdx < oldWords.length && newIdx < newWords.length) {
      if (oldWords[oldIdx] === newWords[newIdx]) {
        result.push({
          type: "context",
          content: oldWords[oldIdx],
        });
        oldIdx++;
        newIdx++;
      } else {
        // Try to find the next match
        let oldMatch = -1;
        let newMatch = -1;

        for (let i = oldIdx + 1; i < oldWords.length; i++) {
          if (oldWords[i] === newWords[newIdx]) {
            oldMatch = i;
            break;
          }
        }

        for (let i = newIdx + 1; i < newWords.length; i++) {
          if (oldWords[oldIdx] === newWords[i]) {
            newMatch = i;
            break;
          }
        }

        if (
          oldMatch !== -1 &&
          (newMatch === -1 || oldMatch - oldIdx <= newMatch - newIdx)
        ) {
          // Old words don't match — mark as removed
          result.push({
            type: "remove",
            content: oldWords[oldIdx],
          });
          oldIdx++;
        } else if (newMatch !== -1) {
          // New words don't match — mark as added
          result.push({
            type: "add",
            content: newWords[newIdx],
          });
          newIdx++;
        } else {
          // No future matches — mark both as diff
          result.push({
            type: "remove",
            content: oldWords[oldIdx],
          });
          result.push({
            type: "add",
            content: newWords[newIdx],
          });
          oldIdx++;
          newIdx++;
        }
      }
    } else if (oldIdx < oldWords.length) {
      result.push({
        type: "remove",
        content: oldWords[oldIdx],
      });
      oldIdx++;
    } else {
      result.push({
        type: "add",
        content: newWords[newIdx],
      });
      newIdx++;
    }
  }

  return result;
}

/**
 * Format diff hunks for terminal display with width constraints.
 * Includes colors-ready output (uses special markers that get replaced by theme colors).
 */
export function formatDiffForTerminal(
  hunks: DiffHunk[],
  width: number,
  contextLines: number = 2,
): string {
  if (hunks.length === 0) return "";

  const lines: string[] = [];

  for (const hunk of hunks) {
    // Hunk header
    lines.push(
      `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`,
    );

    for (const line of hunk.lines) {
      const marker =
        line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
      const lineNum =
        line.type === "add" ? `${line.newLineNum}` : `${line.oldLineNum}`;
      const prefix = `${marker} ${lineNum?.padStart(4)} │ `;

      // Wrap content to width, accounting for prefix
      const maxContentWidth = Math.max(40, width - prefix.length);
      const wrapped = wrapText(line.content, maxContentWidth);

      if (wrapped.length === 0) {
        lines.push(prefix);
      } else {
        lines.push(prefix + wrapped[0]);
        for (let i = 1; i < wrapped.length; i++) {
          lines.push(" ".repeat(prefix.length - 1) + "│ " + wrapped[i]);
        }
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

function wrapText(text: string, width: number): string[] {
  if (text.length <= width) return [text];

  const lines: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= width) {
      lines.push(remaining);
      break;
    }

    // Find last space before width
    const lastSpace = remaining.lastIndexOf(" ", width);
    const breakPoint = lastSpace > 0 ? lastSpace : width;

    lines.push(remaining.substring(0, breakPoint).trim());
    remaining = remaining.substring(breakPoint).trim();
  }

  return lines;
}

/**
 * Count added and removed lines in a set of hunks.
 */
export function countDiffChanges(hunks: DiffHunk[]): {
  added: number;
  removed: number;
} {
  let added = 0;
  let removed = 0;

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === "add") added++;
      else if (line.type === "remove") removed++;
    }
  }

  return { added, removed };
}
