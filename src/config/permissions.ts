/**
 * Permission Rules Engine
 *
 * Enforces access control for file operations and bash commands
 * based on configurable patterns and rules.
 */

export interface Permission {
  action: "read" | "write" | "delete" | "bash";
  patterns: string[];
  allowed: boolean;
  reason?: string;
}

export interface PermissionRules {
  filePermissions: Permission[];
  bashPermissions: Permission[];
  strictMode: boolean;
}

/**
 * Default permission rules - safe defaults for development
 */
const DEFAULT_RULES: PermissionRules = {
  filePermissions: [
    // Allow read everywhere by default
    {
      action: "read",
      patterns: ["**/*"],
      allowed: true,
      reason: "Read allowed by default",
    },
    // Allow write to src/, test/, config/ dirs
    {
      action: "write",
      patterns: [
        "src/**/*",
        "test/**/*",
        "config/**/*",
        "**.ts",
        "**.js",
        "**.json",
      ],
      allowed: true,
      reason: "Write allowed in project directories",
    },
    // Allow delete from src/, test/, config/ dirs
    {
      action: "delete",
      patterns: ["src/**/*", "test/**/*", "config/**/*"],
      allowed: true,
      reason: "Delete allowed in project directories",
    },
    // Deny write to node_modules
    {
      action: "write",
      patterns: ["node_modules/**/*", "dist/**/*", "build/**/*", ".next/**/*"],
      allowed: false,
      reason: "Write denied to build/dependency directories",
    },
    // Deny write to system/hidden dirs
    {
      action: "write",
      patterns: [".git/**/*", ".env*", "/etc/**/*", "/sys/**/*", "/usr/**/*"],
      allowed: false,
      reason: "Write denied to system/version-control directories",
    },
    // Deny delete from node_modules
    {
      action: "delete",
      patterns: ["node_modules/**/*", ".git/**/*"],
      allowed: false,
      reason: "Delete denied for system/dependency directories",
    },
  ],
  bashPermissions: [
    // Allow safe read commands
    {
      action: "bash",
      patterns: [
        "npm*",
        "node*",
        "grep*",
        "find*",
        "ls*",
        "cat*",
        "pwd*",
        "echo*",
      ],
      allowed: true,
      reason: "Safe read/query commands allowed",
    },
    // Allow npm/yarn/pnpm for package management
    {
      action: "bash",
      patterns: ["npm *", "yarn *", "pnpm *"],
      allowed: true,
      reason: "Package manager commands allowed",
    },
    // Deny destructive commands
    {
      action: "bash",
      patterns: [
        "rm *",
        "rmdir *",
        "rm -rf*",
        "chmod *",
        "chown *",
        "sudo *",
        "dd *",
        "format *",
      ],
      allowed: false,
      reason: "Potentially destructive commands denied",
    },
  ],
  strictMode: false,
};

/**
 * Simple glob pattern matcher
 * Supports: * (any chars), ** (any dirs), ? (single char)
 */
function matchesPattern(text: string, pattern: string): boolean {
  // Exact match
  if (text === pattern) return true;

  // Normalize paths
  const normalizedText = text.replace(/\\/g, "/").toLowerCase();
  const normalizedPattern = pattern.replace(/\\/g, "/").toLowerCase();

  // Handle ** (any number of directories)
  if (normalizedPattern.includes("**")) {
    const parts = normalizedPattern.split("**/");
    if (parts.length === 2) {
      const [prefix, suffix] = parts;
      // Check if text contains the suffix somewhere after the prefix
      if (prefix && !normalizedText.startsWith(prefix)) return false;
      if (!suffix) return normalizedText.startsWith(prefix || "");
      // For suffix matching, check if it appears anywhere
      return (
        normalizedText.includes(suffix) ||
        normalizedText.endsWith(suffix.replace("*", ""))
      );
    }
  }

  // Handle * (any characters in a path segment)
  if (normalizedPattern.includes("*")) {
    const regex = normalizedPattern
      .split("*")
      .map((part) => part.replace(/[.+^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${regex}$`).test(normalizedText);
  }

  // Handle ? (single character)
  if (normalizedPattern.includes("?")) {
    const regex = normalizedPattern
      .split("?")
      .map((part) => part.replace(/[.+^${}()|[\]\\]/g, "\\$&"))
      .join(".");
    return new RegExp(`^${regex}$`).test(normalizedText);
  }

  return false;
}

/**
 * Extract the command name from a bash command
 */
function extractCommandName(command: string): string {
  // Extract the first word, handling pipes and redirects
  const parts = command.trim().split(/\s+|[|;>&<]/);
  return parts[0] || "";
}

/**
 * Evaluate a permission request against the rules
 */
export function evaluatePermission(
  action: string,
  resource: string,
  rules: PermissionRules,
): { allowed: boolean; reason: string } {
  const ruleList =
    action === "bash" ? rules.bashPermissions : rules.filePermissions;

  // Search through rules in order - first match wins
  for (const rule of ruleList) {
    if (rule.action !== action) continue;

    for (const pattern of rule.patterns) {
      if (
        matchesPattern(resource, pattern) ||
        matchesPattern(resource.toLowerCase(), pattern.toLowerCase())
      ) {
        return {
          allowed: rule.allowed,
          reason:
            rule.reason || `${action} ${rule.allowed ? "allowed" : "denied"}`,
        };
      }
    }
  }

  // Default: deny if strict mode, allow if permissive
  return {
    allowed: !rules.strictMode,
    reason: `${action} ${rules.strictMode ? "denied" : "allowed"} by default (${rules.strictMode ? "strict" : "permissive"} mode)`,
  };
}

/**
 * Check if a file write is allowed
 */
export function canWrite(
  filePath: string,
  rules: PermissionRules,
): { allowed: boolean; reason: string } {
  return evaluatePermission("write", filePath, rules);
}

/**
 * Check if a file read is allowed
 */
export function canRead(
  filePath: string,
  rules: PermissionRules,
): { allowed: boolean; reason: string } {
  return evaluatePermission("read", filePath, rules);
}

/**
 * Check if a file delete is allowed
 */
export function canDelete(
  filePath: string,
  rules: PermissionRules,
): { allowed: boolean; reason: string } {
  return evaluatePermission("delete", filePath, rules);
}

/**
 * Check if a bash command is allowed
 */
export function canBash(
  command: string,
  rules: PermissionRules,
): { allowed: boolean; reason: string } {
  const cmdName = extractCommandName(command);
  return evaluatePermission("bash", cmdName, rules);
}

/**
 * Load permission rules from a config object or use defaults
 */
export function loadPermissionRules(
  config?: Partial<PermissionRules>,
): PermissionRules {
  if (!config) {
    return DEFAULT_RULES;
  }

  return {
    filePermissions: config.filePermissions ?? DEFAULT_RULES.filePermissions,
    bashPermissions: config.bashPermissions ?? DEFAULT_RULES.bashPermissions,
    strictMode: config.strictMode ?? DEFAULT_RULES.strictMode,
  };
}

// Export default rules
export { DEFAULT_RULES };
