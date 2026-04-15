/**
 * ToolCallPreview — borderless, GitHub Copilot-style inline tool call display.
 *
 * Visual layout (no box borders):
 *
 *   ⠸ read_text  src/components/REPL.tsx          ← pending (spinner)
 *   ✓ bash_run   npm test                          ← success
 *     │ All tests passed
 *     │ … +4 more
 *   ✗ write_file  src/foo.ts                       ← error
 *     ✗ Permission denied
 */

import React from "react";
import { Box, Text } from "../ink.ts";
import { COLORS, SPINNER_FRAMES } from "../ui/theme.ts";
import { FileEditPreview } from "./FileEditPreview.tsx";
import type { FileChange } from "../hooks/useTurnDiffs.ts";

// ──────────────────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────────────────

export type ToolCallStatus = "pending" | "success" | "error";

export interface ToolCallEntry {
  id: string;
  name: string;
  source: string;
  input: Record<string, unknown>;
  status: ToolCallStatus;
  resultPreview?: string;
  isError?: boolean;
  fileChanges?: FileChange[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const MAX_OUTPUT_LINES = 4;
const MAX_LINE_CHARS = 100;
const MAX_SINGLE_VALUE_CHARS = 60;

// ──────────────────────────────────────────────────────────────────────────────
// Tool classification
// ──────────────────────────────────────────────────────────────────────────────

type ToolKind =
  | "terminal"
  | "file-read"
  | "file-write"
  | "file-list"
  | "browser"
  | "search"
  | "memory"
  | "skill"
  | "generic";

function classifyTool(name: string): ToolKind {
  const n = name.toLowerCase();
  if (
    n.includes("bash") ||
    n.includes("shell") ||
    n.includes("exec") ||
    n.includes("run_command") ||
    n.includes("terminal") ||
    n === "run"
  )
    return "terminal";
  if (
    n === "list_dir" ||
    n.includes("list_dir") ||
    n.includes("directory") ||
    n === "ls"
  )
    return "file-list";
  if (
    n === "read_text" ||
    n === "read_multiple" ||
    n === "get_file_info" ||
    n.includes("read_file") ||
    n === "cat"
  )
    return "file-read";
  if (
    n.includes("write") ||
    n.includes("edit") ||
    n.includes("create") ||
    n.includes("patch") ||
    n.includes("insert") ||
    n.includes("delete") ||
    n.includes("rename")
  )
    return "file-write";
  if (
    n.includes("browser") ||
    n.includes("navigate") ||
    n.includes("puppeteer") ||
    n.includes("playwright") ||
    n.includes("click") ||
    n.includes("screenshot") ||
    n.includes("snapshot") ||
    n.includes("scroll") ||
    n.includes("hover") ||
    n.includes("fill") ||
    n.includes("select") ||
    n.includes("wait_for")
  )
    return "browser";
  if (n.includes("search") || n.includes("grep") || n.includes("glob"))
    return "search";
  if (n.includes("memory") || n.includes("memo")) return "memory";
  if (n.includes("skill")) return "skill";
  return "generic";
}

function toolIcon(kind: ToolKind, name: string): string {
  switch (kind) {
    case "terminal":
      return "❯";
    case "file-read":
      return "📄";
    case "file-write":
      return "✏️";
    case "file-list":
      return "📁";
    case "browser": {
      const n = name.toLowerCase();
      if (n.includes("screenshot") || n.includes("snapshot")) return "📸";
      if (n.includes("click")) return "🖱️";
      if (n.includes("fill") || n.includes("type")) return "⌨️";
      return "🌐";
    }
    case "search":
      return "🔍";
    case "memory":
      return "🧠";
    case "skill":
      return "📚";
    default:
      return "⚙️";
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Value helpers
// ──────────────────────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function strVal(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** The single most-important display value from the input args */
function primaryDisplay(
  kind: ToolKind,
  input: Record<string, unknown>,
): string | null {
  switch (kind) {
    case "terminal":
      return (
        strVal(input["command"] ?? input["cmd"] ?? input["script"] ?? "") ||
        null
      );
    case "file-read":
    case "file-write":
      return (
        strVal(input["path"] ?? input["file"] ?? input["filePath"] ?? "") ||
        null
      );
    case "file-list":
      return (
        strVal(input["path"] ?? input["dir"] ?? input["dirPath"] ?? "") || null
      );
    case "browser": {
      const url = strVal(input["url"] ?? "");
      const selector = strVal(input["selector"] ?? input["element"] ?? "");
      const text = strVal(input["text"] ?? input["value"] ?? "");
      return url || selector || text || null;
    }
    case "search": {
      const q = strVal(
        input["query"] ?? input["pattern"] ?? input["glob"] ?? "",
      );
      const p = strVal(input["path"] ?? input["dir"] ?? "");
      return q && p ? `${q}  in  ${p}` : q || p || null;
    }
    default: {
      for (const key of Object.keys(input)) {
        const v = input[key];
        if (typeof v === "string" && v.length > 0)
          return truncate(v, MAX_SINGLE_VALUE_CHARS);
      }
      return null;
    }
  }
}

/** Secondary (contextual) args after the primary one */
function secondaryArgs(
  kind: ToolKind,
  input: Record<string, unknown>,
  primary: string | null,
): [string, string][] {
  const skipKeys = new Set<string>();
  switch (kind) {
    case "terminal":
      skipKeys.add("command");
      skipKeys.add("cmd");
      skipKeys.add("script");
      break;
    case "file-read":
    case "file-write":
      skipKeys.add("path");
      skipKeys.add("file");
      skipKeys.add("filePath");
      break;
    case "file-list":
      skipKeys.add("path");
      skipKeys.add("dir");
      skipKeys.add("dirPath");
      break;
    case "browser":
      skipKeys.add("url");
      skipKeys.add("selector");
      skipKeys.add("element");
      skipKeys.add("text");
      skipKeys.add("value");
      break;
    case "search":
      skipKeys.add("query");
      skipKeys.add("pattern");
      skipKeys.add("glob");
      skipKeys.add("path");
      skipKeys.add("dir");
      break;
  }

  const result: [string, string][] = [];
  for (const [k, v] of Object.entries(input)) {
    if (skipKeys.has(k)) continue;
    const rendered = truncate(strVal(v), MAX_SINGLE_VALUE_CHARS);
    if (rendered === primary) continue;
    result.push([k, rendered]);
    if (result.length >= 3) break;
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// Output lines — flat, indented, no border
// ──────────────────────────────────────────────────────────────────────────────

interface OutputLinesProps {
  output: string;
  isError: boolean;
  kind: ToolKind;
}

function OutputLines({
  output,
  isError,
  kind,
}: OutputLinesProps): React.ReactElement | null {
  const raw = output.trim();
  if (!raw) return null;

  // For terminal: skip blank lines, show up to MAX_OUTPUT_LINES with │ prefix
  if (kind === "terminal") {
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const shown = lines.slice(0, MAX_OUTPUT_LINES);
    const hidden = lines.length - shown.length;
    const gutterColor = isError ? COLORS.error : COLORS.border;

    return (
      <Box flexDirection="column" paddingLeft={3}>
        {shown.map((line, i) => (
          <Box key={i} flexDirection="row">
            <Text color={gutterColor} dimColor>
              │{" "}
            </Text>
            <Text
              color={isError ? COLORS.error : COLORS.assistantText}
              wrap="truncate-end"
              dimColor
            >
              {truncate(line, MAX_LINE_CHARS)}
            </Text>
          </Box>
        ))}
        {hidden > 0 && (
          <Box flexDirection="row">
            <Text color={gutterColor} dimColor>
              │{" "}
            </Text>
            <Text color={COLORS.dim} dimColor>
              … +{hidden} line{hidden === 1 ? "" : "s"}
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  // For all other kinds: first line on same indent, rest truncated
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const shown = lines.slice(
    0,
    kind === "file-read" || kind === "file-list" ? 3 : 2,
  );
  const hidden = lines.length - shown.length;

  return (
    <Box flexDirection="column" paddingLeft={3}>
      {shown.map((line, i) => (
        <Text
          key={i}
          color={isError ? COLORS.error : COLORS.dim}
          wrap="truncate-end"
          dimColor={!isError}
        >
          {truncate(line, MAX_LINE_CHARS)}
        </Text>
      ))}
      {hidden > 0 && (
        <Text color={COLORS.dim} dimColor>
          … +{hidden} more
        </Text>
      )}
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Single tool call row — flat, no box border
// ──────────────────────────────────────────────────────────────────────────────

interface ToolRowProps {
  entry: ToolCallEntry;
  spinnerFrame: number;
  terminalWidth: number;
}

function ToolRow({
  entry,
  spinnerFrame,
  terminalWidth,
}: ToolRowProps): React.ReactElement {
  const { name, source, input, status, resultPreview, isError = false } = entry;
  const kind = classifyTool(name);
  const icon = toolIcon(kind, name);
  const primary = primaryDisplay(kind, input);
  const secondary = secondaryArgs(kind, input, primary);

  // Source label: only show when it's a named MCP server (not builtin)
  const sourceLabel =
    source !== "builtin" && source !== "unknown" ? source : null;

  let statusChar: string;
  let statusColor: string;
  if (status === "pending") {
    statusChar = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]!;
    statusColor = COLORS.warningBright;
  } else if (status === "success") {
    statusChar = "✓";
    statusColor = COLORS.success;
  } else {
    statusChar = "✗";
    statusColor = COLORS.errorBright;
  }

  return (
    <Box flexDirection="column">
      {/* ── Single header line: [status] [icon] [name] [source?] [·] [primary] ── */}
      <Box flexDirection="row" gap={1} alignItems="flex-start">
        <Text color={statusColor} bold>
          {statusChar}
        </Text>
        <Text color={COLORS.dim}>{icon}</Text>
        <Text
          bold
          color={
            status === "pending"
              ? COLORS.warning
              : status === "error"
                ? COLORS.error
                : COLORS.assistant
          }
        >
          {name}
        </Text>
        {sourceLabel && (
          <Text color={COLORS.dim} dimColor>
            {sourceLabel}
          </Text>
        )}
        {primary && (
          <>
            <Text color={COLORS.dim} dimColor>
              ·
            </Text>
            <Text
              color={kind === "terminal" ? COLORS.assistantText : COLORS.dim}
              wrap="truncate-end"
              dimColor={kind !== "terminal"}
            >
              {truncate(primary, MAX_SINGLE_VALUE_CHARS)}
            </Text>
          </>
        )}
      </Box>

      {/* ── Secondary args: only when no primary or when extra context is useful ── */}
      {secondary.length > 0 && !primary && (
        <Box flexDirection="column" paddingLeft={3}>
          {secondary.map(([k, v]) => (
            <Box key={k} flexDirection="row" gap={1}>
              <Text color={COLORS.dim} dimColor>
                {k}:
              </Text>
              <Text color={COLORS.dim} wrap="truncate-end" dimColor>
                {v}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* ── Output — skip for file-write tools when we have a diff ── */}
      {resultPreview &&
        status !== "pending" &&
        !(entry.fileChanges && entry.fileChanges.length > 0) && (
          <OutputLines output={resultPreview} isError={isError} kind={kind} />
        )}

      {/* ── File diff — shown after file-write tool completes ── */}
      {entry.fileChanges &&
        entry.fileChanges.length > 0 &&
        status !== "pending" && (
          <Box paddingLeft={3} marginTop={0}>
            <FileEditPreview
              changes={entry.fileChanges}
              terminalWidth={terminalWidth}
            />
          </Box>
        )}
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Container — borderless, flows naturally in chat
// ──────────────────────────────────────────────────────────────────────────────

export interface ToolCallPreviewProps {
  entries: ToolCallEntry[];
  spinnerFrame: number;
  terminalWidth?: number;
}

export function ToolCallPreview({
  entries,
  spinnerFrame,
  terminalWidth = 80,
}: ToolCallPreviewProps): React.ReactElement | null {
  if (entries.length === 0) return null;

  return (
    <Box flexDirection="column" gap={0}>
      {entries.map((entry) => (
        <ToolRow
          key={entry.id}
          entry={entry}
          spinnerFrame={spinnerFrame}
          terminalWidth={terminalWidth}
        />
      ))}
    </Box>
  );
}
