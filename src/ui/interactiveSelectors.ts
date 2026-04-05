import chalk from "chalk";
import figures from "figures";
import indentString from "indent-string";
import wrapAnsi from "wrap-ansi";
import type { ModelOption } from "../types.ts";

export interface SelectableItem {
  id: string;
  label: string;
  description: string;
  metadata?: Record<string, string>; // pricing, context window, etc.
  selected?: boolean;
  recommended?: boolean;
}

/**
 * Render a single selectable item in a menu
 */
export function formatMenuItem(
  item: SelectableItem,
  index: number,
  isSelected: boolean,
  showMetadata: boolean = true,
): string {
  const prefix = isSelected ? chalk.cyan(figures.pointer) : "  ";
  const label = chalk.bold(item.label);
  const checkmark = item.selected
    ? ` ${chalk.green(figures.tick)}`
    : item.recommended
      ? chalk.yellow(" ★")
      : "";

  let line = `${prefix} ${index + 1}. ${label}${checkmark}`;

  if (item.description) {
    line += `\n     ${chalk.dim(item.description)}`;
  }

  if (showMetadata && item.metadata) {
    const metaLines = Object.entries(item.metadata).map(
      ([key, value]) => `${chalk.gray(key)}: ${value}`,
    );
    line += "\n     " + indentString(metaLines.join("\n"), 5).slice(5);
  }

  return line;
}

/**
 * Format a selection menu for models, modes, etc.
 */
export function formatSelectionMenu(
  title: string,
  description: string,
  items: SelectableItem[],
  currentIndex: number = -1,
  options?: { maxItems?: number; showMetadata?: boolean },
): string {
  const maxItems = options?.maxItems ?? 10;
  const showMetadata = options?.showMetadata ?? true;

  const border = chalk.dim("─".repeat(80));
  const titleText = chalk.bold.cyan(title);
  const descText = chalk.dim(description);

  const visibleItems = items.slice(0, maxItems);
  const menuItems = visibleItems
    .map((item, idx) =>
      formatMenuItem(item, idx, idx === currentIndex, showMetadata),
    )
    .join("\n\n");

  const footer = chalk.dim(`
  ${figures.arrowUp}${figures.arrowDown} to navigate · ${chalk.bold("Enter")} to confirm · ${chalk.bold("Esc")} to exit
`);

  return `${border}\n${titleText}\n${descText}\n\n${menuItems}\n${footer}${border}`;
}

/**
 * Format model selection with pricing and capabilities
 */
export function formatModelSelectionMenu(
  models: Array<
    ModelOption & { pricing?: string; context?: string; recommended?: boolean }
  >,
  currentIndex: number = -1,
): string {
  const items: SelectableItem[] = models.map((model) => ({
    id: model.id,
    label: model.label,
    description: model.description || "",
    metadata: {
      ...(model.pricing && { pricing: model.pricing }),
      ...(model.context && { context: model.context }),
    },
    recommended: model.recommended,
  }));

  return formatSelectionMenu(
    "Select Model",
    "Switch between available AI models. Choose based on your task complexity, budget, or context needs.",
    items,
    currentIndex,
    { showMetadata: true },
  );
}

/**
 * Format mode selection
 */
export function formatModeSelectionMenu(
  modes: Array<{ id: string; label: string; description: string }>,
  currentIndex: number = -1,
  selected?: string[],
): string {
  const items: SelectableItem[] = modes.map((mode) => ({
    id: mode.id,
    label: mode.label,
    description: mode.description,
    selected: selected?.includes(mode.id),
  }));

  return formatSelectionMenu(
    "Select Mode",
    "Choose one or more modes. Modes activate different capabilities and tools.",
    items,
    currentIndex,
    { showMetadata: false },
  );
}

/**
 * Format MCP selection menu
 */
export function formatMcpSelectionMenu(
  mcpServers: Array<{
    id: string;
    label: string;
    description: string;
    status?: string;
  }>,
  currentIndex: number = -1,
): string {
  const items: SelectableItem[] = mcpServers.map((server) => ({
    id: server.id,
    label: server.label,
    description: server.description,
    metadata: server.status ? { status: server.status } : undefined,
  }));

  return formatSelectionMenu(
    "Model Context Protocol Servers",
    "Available MCP servers and tools. Enable/disable as needed.",
    items,
    currentIndex,
    { showMetadata: true },
  );
}

/**
 * Format skills/tools selection menu
 */
export function formatSkillsSelectionMenu(
  skills: Array<{
    id: string;
    label: string;
    description: string;
    enabled?: boolean;
  }>,
  currentIndex: number = -1,
): string {
  const items: SelectableItem[] = skills.map((skill) => ({
    id: skill.id,
    label: skill.label,
    description: skill.description,
    selected: skill.enabled,
  }));

  return formatSelectionMenu(
    "Available Skills",
    "Enable or disable skills and tools for this session.",
    items,
    currentIndex,
    { showMetadata: false },
  );
}

/**
 * Format a confirmation message
 */
export function formatConfirmation(
  message: string,
  confirmed: boolean = false,
): string {
  const status = confirmed
    ? chalk.green(`✓ ${message}`)
    : chalk.yellow(`• ${message}`);
  return `\n${status}\n`;
}

/**
 * Format an info box
 */
export function formatInfoBox(title: string, content: string): string {
  const border = chalk.dim("┌" + "─".repeat(78) + "┐");
  const titleLine = chalk.blue.bold("│ " + title.padEnd(77) + "│");
  const contentLine = "│ " + indentString(content, 2).slice(2).padEnd(77) + "│";
  const closeBorder = chalk.dim("└" + "─".repeat(78) + "┘");

  return `\n${border}\n${titleLine}\n${contentLine}\n${closeBorder}\n`;
}
