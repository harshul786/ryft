/**
 * ToolCallPreview — rich, per-tool-type inline previews for tool and MCP calls.
 *
 * Each tool type gets a bespoke layout:
 *  - Terminal/bash  → command on header + stdout/stderr block after
 *  - File read/list → path on header + line count + first few lines
 *  - File write/edit→ path on header + result summary
 *  - Browser/nav    → URL or action on header + status
 *  - Generic MCP    → key:value args + multi-line output
 */

import React from "react";
import { Box, Text } from "../ink.ts";
import { COLORS, SPINNER_FRAMES } from "../ui/theme.ts";

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
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const MAX_OUTPUT_LINES = 12;
const MAX_LINE_CHARS = 120;
const MAX_SINGLE_VALUE_CHARS = 80;

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
  if (n === "list_dir" || n.includes("list_dir") || n.includes("directory") || n === "ls")
    return "file-list";
  if (n === "read_text" || n === "read_multiple" || n === "get_file_info" || n.includes("read_file") || n === "cat")
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
    case "terminal":  return "❯";
    case "file-read": return "📄";
    case "file-write": return "✏️";
    case "file-list": return "📁";
    case "browser": {
      const n = name.toLowerCase();
      if (n.includes("screenshot") || n.includes("snapshot")) return "📸";
      if (n.includes("click")) return "🖱️";
      if (n.includes("fill") || n.includes("type")) return "⌨️";
      return "🌐";
    }
    case "search":  return "🔍";
    case "memory":  return "🧠";
    case "skill":   return "📚";
    default:        return "⚙️";
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Source badge
// ──────────────────────────────────────────────────────────────────────────────

function sourceBadge(source: string): { label: string; color: string } {
  if (source === "builtin") return { label: "builtin", color: COLORS.mode };
  const label = source.length > 14 ? source.slice(0, 12) + "…" : source;
  return { label, color: COLORS.warningBright };
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
  try { return JSON.stringify(v); } catch { return String(v); }
}

/** The single most-important display value from the input args */
function primaryDisplay(kind: ToolKind, input: Record<string, unknown>): string | null {
  switch (kind) {
    case "terminal":
      return strVal(input["command"] ?? input["cmd"] ?? input["script"] ?? "") || null;
    case "file-read":
    case "file-write":
      return strVal(input["path"] ?? input["file"] ?? input["filePath"] ?? "") || null;
    case "file-list":
      return strVal(input["path"] ?? input["dir"] ?? input["dirPath"] ?? "") || null;
    case "browser": {
      const url = strVal(input["url"] ?? "");
      const selector = strVal(input["selector"] ?? input["element"] ?? "");
      const text = strVal(input["text"] ?? input["value"] ?? "");
      return url || selector || text || null;
    }
    case "search": {
      const q = strVal(input["query"] ?? input["pattern"] ?? input["glob"] ?? "");
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
      skipKeys.add("command"); skipKeys.add("cmd"); skipKeys.add("script");
      break;
    case "file-read":
    case "file-write":
      skipKeys.add("path"); skipKeys.add("file"); skipKeys.add("filePath");
      break;
    case "file-list":
      skipKeys.add("path"); skipKeys.add("dir"); skipKeys.add("dirPath");
      break;
    case "browser":
      skipKeys.add("url"); skipKeys.add("selector"); skipKeys.add("element");
      skipKeys.add("text"); skipKeys.add("value");
      break;
    case "search":
      skipKeys.add("query"); skipKeys.add("pattern"); skipKeys.add("glob");
      skipKeys.add("path"); skipKeys.add("dir");
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
// Output block — rendered after completion
// ──────────────────────────────────────────────────────────────────────────────

interface OutputBlockProps {
  output: string;
  isError: boolean;
  kind: ToolKind;
}

function OutputBlock({ output, isError, kind }: OutputBlockProps): React.ReactElement {
  const raw = output.trim();

  // ── Terminal: labelled stdout/stderr box with line-by-line output ──
  if (kind === "terminal") {
    const lines = raw.split("\n");
    const shown = lines.slice(0, MAX_OUTPUT_LINES);
    const hidden = lines.length - shown.length;

    return (
      <Box flexDirection="column" paddingLeft={4} marginTop={0}>
        <Text color={isError ? COLORS.errorBright : COLORS.dim} dimColor={!isError}>
          {isError ? "stderr" : "stdout"}
        </Text>
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={isError ? COLORS.error : COLORS.border}
          paddingX={1}
        >
          {shown.map((line, i) => (
            <Text
              key={i}
              color={isError ? COLORS.error : COLORS.assistantText}
              wrap="truncate-end"
            >
              {truncate(line || " ", MAX_LINE_CHARS)}
            </Text>
          ))}
          {hidden > 0 && (
            <Text color={COLORS.dim} dimColor>
              … {hidden} more line{hidden === 1 ? "" : "s"}
            </Text>
          )}
        </Box>
      </Box>
    );
  }

  // ── Browser: first line summary ──
  if (kind === "browser") {
    const summary = truncate(raw.split("\n")[0] ?? raw, 200);
    return (
      <Box paddingLeft={4} marginTop={0}>
        <Text color={isError ? COLORS.error : COLORS.dim} dimColor={!isError}>
          {isError ? "✗ " : "↳ "}{summary}
        </Text>
      </Box>
    );
  }

  // ── File read / list: line count + first few lines ──
  if (kind === "file-read" || kind === "file-list") {
    const lines = raw.split("\n");
    const shown = lines.slice(0, 6);
    const hidden = lines.length - shown.length;
    return (
      <Box flexDirection="column" paddingLeft={4} marginTop={0}>
        <Text color={COLORS.dim} dimColor>
          {lines.length} line{lines.length === 1 ? "" : "s"}
        </Text>
        {shown.map((line, i) => (
          <Text key={i} color={COLORS.assistantText} wrap="truncate-end" dimColor>
            {truncate(line || " ", MAX_LINE_CHARS)}
          </Text>
        ))}
        {hidden > 0 && (
          <Text color={COLORS.dim} dimColor>… {hidden} more</Text>
        )}
      </Box>
    );
  }

  // ── Generic / search / memory: multi-line output ──
  const lines = raw.split("\n");
  const shown = lines.slice(0, 5);
  const hidden = lines.length - shown.length;
  return (
    <Box flexDirection="column" paddingLeft={4} marginTop={0}>
      {shown.map((line, i) => (
        <Text
          key={i}
          color={isError ? COLORS.error : COLORS.dim}
          wrap="truncate-end"
          dimColor={!isError}
        >
          {i === 0 ? (isError ? "✗ " : "↳ ") : "  "}
          {truncate(line, MAX_LINE_CHARS)}
        </Text>
      ))}
      {hidden > 0 && (
        <Text color={COLORS.dim} dimColor>{"  "}… {hidden} more</Text>
      )}
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Single tool call row
// ──────────────────────────────────────────────────────────────────────────────

interface ToolRowProps {
  entry: ToolCallEntry;
  spinnerFrame: number;
}

function ToolRow({ entry, spinnerFrame }: ToolRowProps): React.ReactElement {
  const { name, source, input, status, resultPreview, isError = false } = entry;
  const kind = classifyTool(name);
  const badge = sourceBadge(source);
  const icon = toolIcon(kind, name);
  const primary = primaryDisplay(kind, input);
  const secondary = secondaryArgs(kind, input, primary);

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
    <Box flexDirection="column" marginBottom={1}>
      {/* ── Header: [status] [icon] [name] [badge] [primary value] ── */}
      <Box flexDirection="row" gap={1} alignItems="flex-start">
        <Box minWidth={2} flexShrink={0}>
          <Text color={statusColor} bold>{statusChar}</Text>
        </Box>
        <Box flexShrink={0}>
          <Text>{icon}</Text>
        </Box>
        <Text bold color={COLORS.assistant}>{name}</Text>
        <Box borderStyle="round" borderColor={badge.color} paddingX={1} flexShrink={0}>
          <Text color={badge.color as any} dimColor>{badge.label}</Text>
        </Box>
        {primary && (
          <Text
            color={kind === "terminal" ? COLORS.warningBright : COLORS.assistantText}
            bold={kind === "terminal"}
            wrap="truncate-end"
          >
            {truncate(primary, MAX_SINGLE_VALUE_CHARS)}
          </Text>
        )}
      </Box>

      {/* ── Secondary args ── */}
      {secondary.length > 0 && (
        <Box flexDirection="column" paddingLeft={4}>
          {secondary.map(([k, v]) => (
            <Box key={k} flexDirection="row" gap={1}>
              <Text color={COLORS.dim}>{k}:</Text>
              <Text color={COLORS.assistantText} wrap="truncate-end">{v}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* ── Output block — only after completion ── */}
      {resultPreview && status !== "pending" && (
        <OutputBlock output={resultPreview} isError={isError} kind={kind} />
      )}
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Container
// ──────────────────────────────────────────────────────────────────────────────

export interface ToolCallPreviewProps {
  entries: ToolCallEntry[];
  spinnerFrame: number;
}

export function ToolCallPreview({
  entries,
  spinnerFrame,
}: ToolCallPreviewProps): React.ReactElement | null {
  if (entries.length === 0) return null;

  const anyPending = entries.some((e) => e.status === "pending");
  const anyError = entries.some((e) => e.status === "error");

  const borderColor = anyPending
    ? COLORS.warningBright
    : anyError
      ? COLORS.errorBright
      : COLORS.success;

  const headerLabel = entries.length === 1 ? "tool call" : `${entries.length} tool calls`;
  const headerStatus = anyPending ? "running" : anyError ? "done · errors" : "done";

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
      marginLeft={1}
    >
      <Box flexDirection="row" gap={1} marginBottom={1}>
        <Text bold color={borderColor}>{headerLabel}</Text>
        <Text color={COLORS.dim}>·</Text>
        <Text color={COLORS.dim}>{headerStatus}</Text>
      </Box>

      {entries.map((entry) => (
        <ToolRow key={entry.id} entry={entry} spinnerFrame={spinnerFrame} />
      ))}
    </Box>
  );
}
