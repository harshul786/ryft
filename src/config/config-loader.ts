import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ConfigFile, ParsedConfig } from "./types.ts";
import { CONFIG_DEFAULTS, validateConfig } from "./types.ts";

/**
 * Load configuration from files and environment with precedence:
 * defaults < global (~/.ryftrc) < workspace (.ryft.json) < env vars (RYFT_*) < CLI flags (applied separately)
 */
export function loadConfig(): ParsedConfig {
  const globalConfig = loadGlobalConfig();
  const workspaceConfig = loadWorkspaceConfig();
  const envConfig = loadEnvConfig();

  // Merge with precedence
  const merged: ParsedConfig = {
    ...CONFIG_DEFAULTS,
    ...globalConfig,
    ...workspaceConfig,
    ...envConfig,
  };

  // Log precedence chain in debug mode
  if (process.env.DEBUG) {
    const sources = [];
    if (globalConfig._source) sources.push(`global (${globalConfig._path})`);
    if (workspaceConfig._source)
      sources.push(`workspace (${workspaceConfig._path})`);
    if (envConfig._source) sources.push("environment variables");
    if (sources.length > 0) {
      console.debug(
        `[CONFIG] Using configuration from: ${sources.join(" → ")}`,
      );
    }
  }

  return merged;
}

/**
 * Load configuration from environment variables (RYFT_* prefix)
 * Examples: RYFT_MODEL=gpt-4, RYFT_PROXY=http://localhost:3000
 *
 * Validates values and logs configuration precedence
 */
function loadEnvConfig(): ParsedConfig {
  const envConfig: ParsedConfig = {};
  const loadedVars = new Set<string>();

  const mapping = {
    RYFT_MODEL: "model",
    RYFT_API_KEY: "apiKey",
    RYFT_PROXY: "proxyUrl",
    RYFT_BASE_URL: "baseUrl",
    RYFT_MEMORY_MODE: "memoryMode",
  } as const;

  // Helper to validate URLs
  function isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Helper to validate memory mode
  function isValidMemoryMode(mode: string): boolean {
    return ["claude-like", "hierarchy", "session"].includes(mode);
  }

  for (const [envKey, configKey] of Object.entries(mapping)) {
    const value = process.env[envKey];
    if (value) {
      // Validate based on config key
      let valid = true;
      let error: string | null = null;

      if (configKey === "proxyUrl" || configKey === "baseUrl") {
        if (!isValidUrl(value)) {
          valid = false;
          error = `Invalid URL: ${value}`;
        }
      } else if (configKey === "memoryMode") {
        if (!isValidMemoryMode(value)) {
          valid = false;
          error = `Invalid memory mode: ${value}. Must be one of: claude-like, hierarchy, session`;
        }
      }

      if (!valid) {
        if (process.env.DEBUG) {
          console.warn(
            `⚠️  Skipping invalid environment variable ${envKey}: ${error}`,
          );
        }
        continue;
      }

      // @ts-ignore - dynamic key assignment
      envConfig[configKey] = value;
      loadedVars.add(envKey);

      if (process.env.DEBUG) {
        console.debug(
          `[CONFIG] Loaded from ${envKey}: ${configKey}=${value.substring(0, 20)}${value.length > 20 ? "..." : ""}`,
        );
      }
    }
  }

  if (Object.keys(envConfig).length > 0) {
    envConfig._source = "env";
    if (process.env.DEBUG) {
      console.debug(
        `[CONFIG PRECEDENCE] Environment variables override file/default config (${loadedVars.size} vars loaded)`,
      );
    }
  }

  return envConfig;
}

/**
 * Load global config from ~/.ryftrc
 */
function loadGlobalConfig(): ParsedConfig {
  const globalPath = join(homedir(), ".ryftrc");
  try {
    const content = readFileSync(globalPath, "utf-8");
    const parsed = JSON.parse(content);
    const errors = validateConfig(parsed);
    if (errors.length > 0) {
      console.warn(`Warning: Invalid config in ${globalPath}:`, errors);
      return {};
    }
    return { ...parsed, _source: "global", _path: globalPath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      // File doesn't exist, that's ok
      return {};
    }
    console.warn(
      `Warning: Failed to read global config at ${globalPath}:`,
      error,
    );
    return {};
  }
}

/**
 * Load workspace config from .ryft.json in current working directory
 */
function loadWorkspaceConfig(): ParsedConfig {
  const workspacePath = join(process.cwd(), ".ryft.json");
  try {
    const content = readFileSync(workspacePath, "utf-8");
    const parsed = JSON.parse(content);
    const errors = validateConfig(parsed);
    if (errors.length > 0) {
      console.warn(`Warning: Invalid config in ${workspacePath}:`, errors);
      return {};
    }
    return { ...parsed, _source: "workspace", _path: workspacePath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      // File doesn't exist, that's ok
      return {};
    }
    console.warn(
      `Warning: Failed to read workspace config at ${workspacePath}:`,
      error,
    );
    return {};
  }
}

/**
 * Apply CLI flags on top of loaded config
 */
export function applyCliOverrides(
  config: ParsedConfig,
  cliFlags: Record<string, unknown>,
): ParsedConfig {
  const overrides: ParsedConfig = { ...config, _source: "cli" };

  if (cliFlags.model) overrides.model = String(cliFlags.model);
  if (cliFlags.provider) overrides.provider = String(cliFlags.provider);
  if (cliFlags.mode)
    overrides.defaultModes = Array.isArray(cliFlags.mode)
      ? (cliFlags.mode as string[])
      : [String(cliFlags.mode)];
  if (cliFlags.memory)
    overrides.defaultMemoryMode = String(cliFlags.memory) as any;
  if (cliFlags.browser !== undefined)
    overrides.defaultBrowser = cliFlags.browser === true;
  if (cliFlags.proxyUrl) overrides.proxyUrl = String(cliFlags.proxyUrl);
  if (cliFlags.baseUrl) overrides.baseUrl = String(cliFlags.baseUrl);
  if (cliFlags.apiKey) overrides.apiKey = String(cliFlags.apiKey);

  return overrides;
}
