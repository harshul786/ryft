import chalk from "chalk";
import figures from "figures";
import stripAnsi from "strip-ansi";
import indentString from "indent-string";

export interface CommandSuggestion {
  command: string;
  description: string;
  alias?: string;
}

export const AVAILABLE_COMMANDS: CommandSuggestion[] = [
  { command: "/help", description: "Show help and available commands" },
  { command: "/mode", description: "Set the prompt mode for this session" },
  { command: "/model", description: "Set the AI model for this session" },
  { command: "/config", description: "View or modify configuration" },
  { command: "/skills", description: "Show available skills and tools" },
  { command: "/mcp", description: "Manage Model Context Protocol" },
  {
    command: "/memory",
    description: "Switch memory mode (claude-like, hierarchy, session)",
  },
  { command: "/tokens", description: "Show token usage for this session" },
  { command: "/compact", description: "Compact conversation history" },
  { command: "/exit", description: "Exit the REPL" },
  { command: "/quit", description: "Exit the REPL" },
];

/**
 * Filter commands based on user input
 */
export function filterCommands(input: string): CommandSuggestion[] {
  if (!input.startsWith("/")) return [];

  const query = input.slice(1).toLowerCase();
  if (!query) return AVAILABLE_COMMANDS;

  return AVAILABLE_COMMANDS.filter(
    (cmd) =>
      cmd.command.toLowerCase().includes(query) ||
      (cmd.alias && cmd.alias.toLowerCase().includes(query)) ||
      cmd.description.toLowerCase().includes(query),
  );
}

/**
 * Format command suggestions as a dropdown menu
 */
export function formatCommandSuggestions(
  input: string,
  maxItems: number = 6,
): string {
  const suggestions = filterCommands(input);
  if (suggestions.length === 0) return "";

  const items = suggestions.slice(0, maxItems).map((cmd) => {
    const cmdPart = chalk.cyan(cmd.command.padEnd(20));
    const descPart = chalk.dim(cmd.description);
    return `  ${cmdPart} ${descPart}`;
  });

  const borderTop = chalk.dim("─".repeat(80));
  const borderBottom = chalk.dim("─".repeat(80));

  return `${borderTop}\n${items.join("\n")}\n${borderBottom}`;
}

/**
 * Format a complete help menu
 */
export function formatHelpMenu(): string {
  const header = chalk.bold.cyan("\n" + "─".repeat(80));
  const title = chalk.bold("Available Commands:");
  const footer = chalk.dim("─".repeat(80) + "\n");

  const commands = AVAILABLE_COMMANDS.map((cmd) => {
    const cmdPart = chalk.cyan(cmd.command.padEnd(20));
    const descPart = cmd.description;
    return `  ${cmdPart}  ${descPart}`;
  });

  return `${header}\n${title}\n${commands.join("\n")}\n${footer}`;
}
