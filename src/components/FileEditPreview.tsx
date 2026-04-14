/**
 * FileEditPreview — visual display of file edits with diff highlighting.
 * Shows before/after diffs with color-coded additions and removals.
 */

import React, { useMemo } from "react";
import { Box, Text } from "../ink.ts";
import type { FileChange } from "../hooks/useTurnDiffs.ts";
import {
  formatDiffAdded,
  formatDiffRemoved,
  formatDiffContext,
} from "../ui/theme.ts";
import { countDiffChanges } from "../ui/diff.ts";

interface FileEditPreviewProps {
  changes: FileChange[];
  terminalWidth: number;
  showOnlyFirst?: boolean;
}

/**
 * Renders file edit preview(s) with diffs.
 * Optionally displays only the first file's changes (when used inline).
 */
export const FileEditPreview: React.FC<FileEditPreviewProps> = ({
  changes,
  terminalWidth,
  showOnlyFirst = false,
}) => {
  const filesToShow = useMemo(
    () => (showOnlyFirst ? changes.slice(0, 1) : changes),
    [changes, showOnlyFirst],
  );

  if (filesToShow.length === 0) return null;

  return (
    <Box flexDirection="column">
      {filesToShow.map((change, idx) => (
        <FileEditItem key={idx} change={change} terminalWidth={terminalWidth} />
      ))}
    </Box>
  );
};

interface FileEditItemProps {
  change: FileChange;
  terminalWidth: number;
}

/**
 * Single file edit display with stats and diff preview.
 */
const FileEditItem: React.FC<FileEditItemProps> = ({
  change,
  terminalWidth,
}) => {
  const { added, removed } = useMemo(
    () => countDiffChanges(change.hunks),
    [change.hunks],
  );

  const headerText = `${change.path} (+${added} -${removed})`;

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Header: file path and stats */}
      <Box marginBottom={0}>
        <Text color="cyan" bold>
          📝 File:{" "}
        </Text>
        <Text color="cyan">{headerText}</Text>
      </Box>

      {/* Diff preview */}
      <Box flexDirection="column" marginLeft={2} marginTop={0}>
        {change.hunks.map((hunk, hunkIdx) => (
          <HunkDisplay
            key={hunkIdx}
            hunk={hunk}
            terminalWidth={terminalWidth}
          />
        ))}
      </Box>
    </Box>
  );
};

import type { DiffHunk } from "../ui/diff.ts";

interface HunkDisplayProps {
  hunk: DiffHunk;
  terminalWidth: number;
}

/**
 * Display a single diff hunk with color-coded lines.
 */
const HunkDisplay: React.FC<HunkDisplayProps> = ({ hunk, terminalWidth }) => {
  const maxWidth = Math.max(40, terminalWidth - 8);

  return (
    <Box flexDirection="column" marginBottom={0}>
      {/* Hunk header */}
      <Text color="gray" dimColor={true}>
        @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
      </Text>

      {/* Diff lines */}
      {hunk.lines.slice(0, 10).map((line, lineIdx) => {
        // Limit display to 10 lines per hunk to avoid massive output
        const marker =
          line.type === "add"
            ? "+"
            : line.type === "remove"
              ? "-"
              : " ";

        const lineNum =
          line.type === "add"
            ? line.newLineNum
            : line.oldLineNum;
        const numStr = lineNum ? String(lineNum).padStart(4) : "    ";

        let styledContent: React.ReactNode;
        if (line.type === "add") {
          styledContent = formatDiffAdded(line.content);
        } else if (line.type === "remove") {
          styledContent = formatDiffRemoved(line.content);
        } else {
          styledContent = formatDiffContext(line.content);
        }

        // Truncate very long lines
        const displayContent =
          line.content.length > maxWidth
            ? line.content.substring(0, maxWidth - 3) + "…"
            : line.content;

        return (
          <Box key={lineIdx} flexDirection="row">
            <Text color={line.type === "add" ? "green" : "red"}>
              {marker}
            </Text>
            <Text color="gray"> {numStr} │ </Text>
            <Text>{styledContent}</Text>
          </Box>
        );
      })}

      {/* Show count if more lines exist */}
      {hunk.lines.length > 10 && (
        <Text color="gray" dimColor={true}>
          … and {hunk.lines.length - 10} more lines
        </Text>
      )}
    </Box>
  );
};
