/**
 * Enhanced command suggestions using CLI framework's discovery
 */

import { getCommandSuggestions } from "../commands.ts";
import type { CommandContext } from "../commands.ts";
import chalk from "chalk";
import figures from "figures";
import stripAnsi from "strip-ansi";
import indentString from "indent-string";

export interface CommandSuggestion {
  command: string;
  description: string;
  alias?: string;
}

/**
 * Filter commands based on user input
 * Uses framework's dynamic command discovery
 */
export async function filterCommands(
  input: string,
  context?: CommandContext,
): Promise<CommandSuggestion[]> {
  if (!input.startsWith("/")) return [];

  const query = input.slice(1).toLowerCase();

  try {
    // Use framework's getSuggestions for better matching
    const suggestions = await getCommandSuggestions(query, context);

    return suggestions.map((cmd) => ({
      command: `/${cmd.name}`,
      description: cmd.description,
      alias: cmd.aliases[0],
    }));
  } catch (error) {
    // Fallback to basic filtering if framework call fails
    console.warn("Error getting command suggestions:", error);
    return [];
  }
}

/**
 * Get all available commands
 */
export async function getAllCommands(
  context?: CommandContext,
): Promise<CommandSuggestion[]> {
  return filterCommands("/", context);
}

/**
 * Format command suggestion for display
 */
export function formatCommandSuggestion(suggestion: CommandSuggestion): string {
  const name = chalk.cyan(suggestion.command);
  const desc = suggestion.description;
  const alias = suggestion.alias ? ` (${chalk.dim(suggestion.alias)})` : "";
  return `${name}${alias} - ${desc}`;
}

/**
 * Format command suggestions as a dropdown menu
 */
export function formatCommandSuggestions(
  suggestions: CommandSuggestion[],
): string {
  if (suggestions.length === 0) return "";

  const maxWidth = Math.max(
    ...suggestions.map((s) => stripAnsi(s.command).length),
  );

  const formatted = suggestions
    .map((s) => {
      const cmdPadded = s.command.padEnd(
        maxWidth + (s.command.length - stripAnsi(s.command).length),
      );
      return `  ${figures.pointer} ${cmdPadded}  ${chalk.dim(s.description)}`;
    })
    .join("\n");

  return indentString(formatted, 0);
}

/**
 * Format as help text
 */
export function formatCommandsHelp(suggestions: CommandSuggestion[]): string {
  if (suggestions.length === 0) {
    return "No commands available.";
  }

  const lines = suggestions.map(
    (s) => `  ${s.command.padEnd(16)} - ${s.description}`,
  );

  return "Available Commands:\n" + lines.join("\n");
}
