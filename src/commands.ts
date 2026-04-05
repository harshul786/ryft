/**
 * Command System
 * Extends the shared CLI framework with Ryft-specific configuration
 */

import {
  CommandRegistry,
  createCommand,
  createLazy,
  type Command as FrameworkCommand,
  type CommandContext as FrameworkCommandContext,
} from "@browser-agent/cli-framework";
import type { Session } from "./runtime/session.ts";
import type { AppState } from "./state/AppStateStore.ts";

/**
 * Ryft-specific command context
 * Extends framework context with Ryft types
 */
export interface CommandContext extends FrameworkCommandContext {
  session: Session;
  appState: AppState;
  setAppState: (updater: (prev: AppState) => AppState) => void;
}

/**
 * Ryft command type (same as framework but with our specific context)
 */
export type Command = Omit<FrameworkCommand, "execute"> & {
  execute: (args: string[], context: CommandContext) => Promise<void> | void;
};

/**
 * Global command registry instance
 */
let registry: CommandRegistry | null = null;

/**
 * Get or create the global command registry
 */
function getRegistry(): CommandRegistry {
  if (!registry) {
    registry = new CommandRegistry();
  }
  return registry;
}

/**
 * Register a command in the registry
 */
export function registerCommand(command: Command): void {
  const reg = getRegistry();
  reg.register(command as FrameworkCommand);
}

/**
 * Get all registered commands
 */
export function getAvailableCommands(): Command[] {
  const reg = getRegistry();
  return reg.getAll() as Command[];
}

/**
 * Find a command by name or alias
 */
export function findCommand(nameOrAlias: string): Command | undefined {
  const reg = getRegistry();
  const found = reg.find(nameOrAlias);
  return found as Command | undefined;
}

/**
 * Execute a command
 */
export async function executeCommand(
  nameOrAlias: string,
  args: string[],
  context: CommandContext,
): Promise<void> {
  const reg = getRegistry();
  // Cast context to framework type for execution
  const frameworkContext = context as unknown as FrameworkCommandContext;
  return reg.execute(nameOrAlias, args, frameworkContext);
}

/**
 * Get command suggestions for autocomplete
 */
export async function getCommandSuggestions(
  prefix: string,
  context?: CommandContext,
): Promise<Command[]> {
  const reg = getRegistry();
  const frameworkContext = context as unknown as
    | FrameworkCommandContext
    | undefined;
  const suggestions = await reg.getSuggestions(prefix, frameworkContext);
  return suggestions as Command[];
}

/**
 * Clear command registry and caches
 */
export function clearCommandRegistry(): void {
  registry = null;
}
