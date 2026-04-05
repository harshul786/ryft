import chalk from "chalk";
import { loadConfig } from "./config-loader.ts";
import { saveConfig, deleteConfigField } from "./config-writer.ts";
import type { ConfigFile } from "./types.ts";
import {
  CONFIG_DEFAULTS,
  VALID_MEMORY_MODES,
  VALID_LOG_LEVELS,
} from "./types.ts";

/**
 * Display current config with source info
 */
export function displayConfigView(): void {
  const config = loadConfig();

  console.log(chalk.bold("\nCurrent Configuration:"));
  console.log(chalk.dim("─".repeat(60)));

  const entries: Array<[string, any, string]> = [
    ["model", config.model ?? CONFIG_DEFAULTS.model, ""],
    ["provider", config.provider ?? CONFIG_DEFAULTS.provider, ""],
    [
      "defaultModes",
      (config.defaultModes ?? CONFIG_DEFAULTS.defaultModes).join(", "),
      "",
    ],
    [
      "defaultMemoryMode",
      config.defaultMemoryMode ?? CONFIG_DEFAULTS.defaultMemoryMode,
      "",
    ],
    [
      "defaultBrowser",
      config.defaultBrowser ?? CONFIG_DEFAULTS.defaultBrowser,
      "",
    ],
    ["baseUrl", config.baseUrl ?? CONFIG_DEFAULTS.baseUrl, ""],
    [
      "proxyUrl",
      config.proxyUrl || "(none)",
      CONFIG_DEFAULTS.proxyUrl ? "" : chalk.dim("(using default)"),
    ],
    [
      "apiKey",
      config.apiKey ? "••••" : "(not set)",
      config.apiKey ? "" : chalk.dim("(using env OPENAI_API_KEY)"),
    ],
    ["logLevel", config.logLevel ?? CONFIG_DEFAULTS.logLevel, ""],
    ["showTokens", config.showTokens ?? CONFIG_DEFAULTS.showTokens, ""],
  ];

  for (const [key, value, source] of entries) {
    const formatted = typeof value === "boolean" ? (value ? "✓" : "✗") : value;
    console.log(`  ${chalk.cyan(key.padEnd(20))} ${formatted} ${source}`);
  }

  console.log(chalk.dim("─".repeat(60)));
  console.log(chalk.dim(`Global config:    ~/.ryftrc`));
  console.log(chalk.dim(`Workspace config: .ryft.json (in current directory)`));
  console.log();
}

/**
 * Set a config value interactively or via arguments
 */
export async function configSet(
  field: string,
  value?: string,
  target: "global" | "workspace" = "global",
): Promise<void> {
  // Validate field name
  const validFields = Object.keys(CONFIG_DEFAULTS);
  if (!validFields.includes(field)) {
    throw new Error(
      `Unknown config field: ${field}\nValid fields: ${validFields.join(", ")}`,
    );
  }

  if (value === undefined) {
    throw new Error(`Value required for field: ${field}`);
  }

  // Coerce and validate value
  const newValue = coerceConfigValue(field, value);

  // Show confirmation
  const config = loadConfig();
  const oldValue =
    (config as Record<string, any>)[field] ??
    CONFIG_DEFAULTS[field as keyof typeof CONFIG_DEFAULTS];
  console.log(`Updating ${target} config:`);
  console.log(`  ${field}: ${oldValue} → ${newValue}`);

  // Save
  saveConfig({ [field]: newValue } as ConfigFile, { target, backup: true });
  console.log(chalk.green("✓ Config saved"));
}

/**
 * Reset a config field to default
 */
export function configUnset(
  field: string,
  target: "global" | "workspace" = "global",
): void {
  const validFields = Object.keys(CONFIG_DEFAULTS);
  if (!validFields.includes(field)) {
    throw new Error(
      `Unknown config field: ${field}\nValid fields: ${validFields.join(", ")}`,
    );
  }

  console.log(
    `Unsetting ${field} in ${target} config (will use default or lower precedence value)`,
  );
  deleteConfigField(field, target);
  console.log(chalk.green("✓ Config updated"));
}

/**
 * Coerce string value to correct type for config field
 */
function coerceConfigValue(field: string, value: string): any {
  const lowerValue = value.toLowerCase();

  switch (field) {
    case "model":
    case "provider":
      return value; // string

    case "defaultModes":
      return value.split(",").map((s) => s.trim()); // array of strings

    case "defaultMemoryMode":
      if (!VALID_MEMORY_MODES.includes(lowerValue as any)) {
        throw new Error(
          `Invalid value for defaultMemoryMode: ${value}\nValid values: ${VALID_MEMORY_MODES.join(", ")}`,
        );
      }
      return lowerValue;

    case "defaultBrowser":
      if (lowerValue === "true" || lowerValue === "1" || lowerValue === "yes")
        return true;
      if (lowerValue === "false" || lowerValue === "0" || lowerValue === "no")
        return false;
      throw new Error(`Invalid boolean value: ${value}`);

    case "proxyUrl":
    case "baseUrl":
      return value; // string

    case "apiKey":
      return value; // string (sensitive)

    case "logLevel":
      if (!VALID_LOG_LEVELS.includes(lowerValue as any)) {
        throw new Error(
          `Invalid value for logLevel: ${value}\nValid values: ${VALID_LOG_LEVELS.join(", ")}`,
        );
      }
      return lowerValue;

    case "showTokens":
      if (lowerValue === "true" || lowerValue === "1" || lowerValue === "yes")
        return true;
      if (lowerValue === "false" || lowerValue === "0" || lowerValue === "no")
        return false;
      throw new Error(`Invalid boolean value: ${value}`);

    default:
      return value;
  }
}
