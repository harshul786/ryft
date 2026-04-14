/**
 * Ryft UI Theme — centralized color palette.
 * All UI components should import from here to stay in sync.
 * Uses named terminal colors for broad compatibility.
 */

import chalk from "chalk";

export const COLORS = {
  /** Primary brand color — blue */
  primary: "blue" as const,
  /** Brighter blue for emphasis */
  primaryBright: "blueBright" as const,
  /** App brand color — magenta stands out clearly */
  brand: "magentaBright" as const,
  /** User message badge */
  user: "greenBright" as const,
  /** User message body text */
  userText: "green" as const,
  /** Assistant message badge */
  assistant: "cyanBright" as const,
  /** Assistant message body text */
  assistantText: "cyan" as const,
  /** Mode label in header */
  mode: "blue" as const,
  /** Model label in header */
  model: "cyanBright" as const,
  /** Success / positive feedback */
  success: "green" as const,
  /** Warning / tool calls in progress */
  warning: "yellow" as const,
  /** Warning bright */
  warningBright: "yellowBright" as const,
  /** Error messages */
  error: "red" as const,
  /** Error bright */
  errorBright: "redBright" as const,
  /** Dimmed / secondary text */
  dim: "gray" as const,
  /** Header separator and borders */
  border: "blue" as const,
  /** Input box border (active, user's turn = green) */
  inputBorder: "green" as const,
  /** Input box border while AI is responding */
  inputBorderWaiting: "gray" as const,
  /** Scroll hint indicator */
  scrollHint: "yellow" as const,
  /** Muted helper text */
  hint: "gray" as const,
  /** Diff: added lines */
  diffAdded: "green" as const,
  /** Diff: removed lines */
  diffRemoved: "red" as const,
  /** Diff: context lines */
  diffContext: "gray" as const,
} as const;

export type ThemeColor = (typeof COLORS)[keyof typeof COLORS];

/** Braille spinner frames for loading animation */
export const SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
] as const;
export const SPINNER_INTERVAL_MS = 80;

// ─── Diff Styling Helpers ──────────────────────────────────────────────────

/**
 * Format text as an added diff line (green).
 */
export function formatDiffAdded(text: string): string {
  return chalk.green(text);
}

/**
 * Format text as a removed diff line (red).
 */
export function formatDiffRemoved(text: string): string {
  return chalk.red(text);
}

/**
 * Format text as diff context (dimmed).
 */
export function formatDiffContext(text: string): string {
  return chalk.dim(text);
}
