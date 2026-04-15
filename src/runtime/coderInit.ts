/**
 * Coder Mode Initialization
 *
 * Sets up permission rules and file state tracking for coder mode
 * when a session is created, based on config and environment variables.
 */

import type { SessionConfig } from "../types";
import {
  loadPermissionRules,
  type PermissionRules,
} from "../config/permissions";
import { fileState } from "../utils/fileState";

export interface CoderInitOptions {
  strictMode?: boolean;
  permissive?: boolean;
  customRules?: PermissionRules;
}

/**
 * Initialize coder mode for a session
 * Sets up permission rules as environment variables for the coder-server subprocess
 */
export function initializeCoderMode(
  config: SessionConfig,
  options?: CoderInitOptions,
): Record<string, string> {
  const rules = resolvePermissionRules(options);

  // Pass permission config to subprocess via environment
  const env: Record<string, string> = {};

  if (options?.strictMode || options?.permissive) {
    env.RYFT_STRICT_MODE = options.strictMode ? "true" : "false";
  }

  // Pass full permission config as JSON for subprocess
  env.RYFT_PERMISSIONS_JSON = JSON.stringify(rules);

  return env;
}

/**
 * Resolve permission rules based on options
 */
function resolvePermissionRules(options?: CoderInitOptions): PermissionRules {
  if (options?.customRules) {
    return options.customRules;
  }

  if (options?.strictMode) {
    return loadPermissionRules({ strictMode: true });
  }

  if (options?.permissive) {
    return loadPermissionRules({ strictMode: false });
  }

  // Default: use loaded config with strictMode from env if available
  return loadPermissionRules({
    strictMode: process.env.RYFT_STRICT_MODE === "true",
  });
}

/**
 * Clear coder state (file state cache, etc.)
 * Call this when switching modes or ending a session
 */
export function clearCoderState(): void {
  fileState.clear();
}

/**
 * Get CLI options for coder mode
 */
export function getCoderCliOptions(): {
  name: string;
  description: string;
  action: (value: string, previous: string) => string;
}[] {
  return [
    {
      name: "--strict-permissions",
      description: "Enforce strict file/bash permissions (deny by default)",
      action: () => "strict",
    },
    {
      name: "--permissive",
      description: "Use permissive file/bash permissions (allow by default)",
      action: () => "permissive",
    },
  ];
}
