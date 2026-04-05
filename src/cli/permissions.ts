/**
 * Permission layers for Ryft CLI commands
 * Integrates framework's permission system with Ryft-specific rules
 */

import {
  PermissionEvaluator,
  permissionFilters,
  type CommandContext as FrameworkContext,
} from "@browser-agent/cli-framework";
import type { CommandContext } from "../commands.ts";

/**
 * Determine if we're in remote/bridge mode based on context
 */
function isRemoteMode(context: CommandContext): boolean {
  // Check if explicitly set in context
  if ((context as any).isRemote) return true;

  // Check if in bridge mode (when bridge is active)
  if ((context as any).inBridgeMode) return true;

  // Check environment variable
  if (process.env.RYFT_REMOTE_MODE === "true") return true;

  // Default to local mode
  return false;
}

/**
 * Create permission evaluator for Ryft
 * Context-aware: only applies restrictive layers in remote mode
 */
export function createRyftPermissionEvaluator(
  context?: CommandContext,
): PermissionEvaluator {
  const remoteMode = context ? isRemoteMode(context) : false;

  const evaluator = new PermissionEvaluator({
    /**
     * Availability layer - is feature available in environment?
     */
    availability: permissionFilters.and(
      // API key must be configured
      permissionFilters.or(
        permissionFilters.requireEnv("OPENAI_API_KEY"),
        permissionFilters.requireEnv("RYFT_API_KEY"),
        permissionFilters.requireContextKey("session"),
      ),
    ),

    /**
     * Enabled layer - can command be used?
     * Most commands are always enabled
     */
    enabled: permissionFilters.allowAll,

    /**
     * Bridge-safe layer - safe for remote execution?
     * Only restrict if in remote mode
     */
    bridgeSafe: remoteMode
      ? permissionFilters.blacklist(["browser", "devtools"])
      : permissionFilters.allowAll,

    /**
     * Remote-safe layer - safe without local filesystem?
     * Only restrict if in remote mode
     */
    remoteSafe: remoteMode
      ? permissionFilters.blacklist([
          "config", // May write to local files
          "skills", // May access local skill files
        ])
      : permissionFilters.allowAll,
  });

  return evaluator;
}

/**
 * Check if command can execute in current context
 */
export async function canExecuteCommand(
  commandName: string,
  context: CommandContext,
): Promise<boolean> {
  const evaluator = createRyftPermissionEvaluator(context);
  const frameworkContext = context as unknown as FrameworkContext;
  return evaluator.canExecute(commandName, frameworkContext);
}

/**
 * Get reason why command was blocked (for debugging)
 */
export async function getCommandBlockReason(
  commandName: string,
  context: CommandContext,
): Promise<string | null> {
  const evaluator = createRyftPermissionEvaluator(context);
  const frameworkContext = context as unknown as FrameworkContext;
  return evaluator.getBlockReason(commandName, frameworkContext);
}

/**
 * Permission scenarios for different modes
 */
export const permissionScenarios = {
  /**
   * Development mode - all commands allowed
   */
  development: () => createRyftPermissionEvaluator() as PermissionEvaluator,

  /**
   * Production mode - limited command set
   */
  production: () => {
    const evaluator = new PermissionEvaluator({
      enabled: permissionFilters.whitelist([
        "help",
        "mode",
        "model",
        "memory",
        "exit",
      ]),
    });
    return evaluator;
  },

  /**
   * API mode - only safe commands for remote execution
   */
  api: () => {
    const evaluator = new PermissionEvaluator({
      enabled: permissionFilters.whitelist(["help", "mode", "model", "memory"]),
      remoteSafe: permissionFilters.whitelist([
        "help",
        "mode",
        "model",
        "memory",
      ]),
    });
    return evaluator;
  },
};
