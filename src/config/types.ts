import type { MemoryModeName, ModelOption } from "../types.ts";

export type MemoryModeType = "normal" | "hierarchy" | "session";

export interface ConfigFile {
  // Onboarding and setup state
  hasCompletedOnboarding?: boolean; // whether user has completed initial setup
  onboardingVersion?: string; // version when onboarding was completed
  onboardingSeenCount?: number; // how many times onboarding has been shown

  // Model and provider settings
  model?: string; // model id or provider-qualified name (e.g., "openai:gpt-4o")
  provider?: string; // provider name (e.g., "openai")
  savedModels?: Array<{
    id: string;
    provider: string;
    baseUrl: string;
    label: string;
  }>; // list of saved model configurations

  // Mode settings
  defaultModes?: string[]; // default modes to activate on startup
  defaultMemoryMode?: MemoryModeType;

  // Browser settings
  defaultBrowser?: boolean;

  // API and proxy settings
  proxyUrl?: string;
  baseUrl?: string;
  apiKey?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  ollamaBaseUrl?: string;

  // Logging and UI settings
  logLevel?: "debug" | "info" | "warn" | "error";
  showTokens?: boolean;
}

export interface ParsedConfig extends ConfigFile {
  // Validated and normalized fields
  _source?: "default" | "global" | "workspace" | "env" | "cli";
  _path?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export const CONFIG_DEFAULTS: Required<ConfigFile> = {
  hasCompletedOnboarding: false,
  onboardingVersion: "0.1.0",
  onboardingSeenCount: 0,
  model: "gpt-4.1",
  provider: "openai",
  savedModels: [],
  defaultModes: ["coder"],
  defaultMemoryMode: "normal",
  defaultBrowser: false,
  proxyUrl: "",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  anthropicApiKey: "",
  geminiApiKey: "",
  ollamaBaseUrl: "",
  logLevel: "info",
  showTokens: true,
};

export const VALID_MEMORY_MODES = ["normal", "hierarchy", "session"] as const;
export const VALID_LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

export function validateConfig(config: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof config !== "object" || config === null) {
    errors.push({ field: "root", message: "Config must be an object" });
    return errors;
  }

  const cfg = config as Record<string, unknown>;

  // Validate onboarding state
  if (
    cfg.hasCompletedOnboarding !== undefined &&
    typeof cfg.hasCompletedOnboarding !== "boolean"
  ) {
    errors.push({
      field: "hasCompletedOnboarding",
      message: "hasCompletedOnboarding must be a boolean",
      value: cfg.hasCompletedOnboarding,
    });
  }

  if (
    cfg.onboardingVersion !== undefined &&
    typeof cfg.onboardingVersion !== "string"
  ) {
    errors.push({
      field: "onboardingVersion",
      message: "onboardingVersion must be a string",
      value: cfg.onboardingVersion,
    });
  }

  if (
    cfg.onboardingSeenCount !== undefined &&
    typeof cfg.onboardingSeenCount !== "number"
  ) {
    errors.push({
      field: "onboardingSeenCount",
      message: "onboardingSeenCount must be a number",
      value: cfg.onboardingSeenCount,
    });
  }

  // Validate saved models
  if (cfg.savedModels !== undefined) {
    if (!Array.isArray(cfg.savedModels)) {
      errors.push({
        field: "savedModels",
        message: "savedModels must be an array",
        value: cfg.savedModels,
      });
    } else {
      for (let i = 0; i < (cfg.savedModels as unknown[]).length; i++) {
        const model = (cfg.savedModels as unknown[])[i];
        if (typeof model !== "object" || model === null) {
          errors.push({
            field: `savedModels[${i}]`,
            message: "each model must be an object",
            value: model,
          });
        } else {
          const m = model as Record<string, unknown>;
          if (typeof m.id !== "string")
            errors.push({
              field: `savedModels[${i}].id`,
              message: "id must be a string",
              value: m.id,
            });
          if (typeof m.provider !== "string")
            errors.push({
              field: `savedModels[${i}].provider`,
              message: "provider must be a string",
              value: m.provider,
            });
          if (typeof m.baseUrl !== "string")
            errors.push({
              field: `savedModels[${i}].baseUrl`,
              message: "baseUrl must be a string",
              value: m.baseUrl,
            });
          if (typeof m.label !== "string")
            errors.push({
              field: `savedModels[${i}].label`,
              message: "label must be a string",
              value: m.label,
            });
        }
      }
    }
  }

  // Validate model
  if (cfg.model !== undefined && typeof cfg.model !== "string") {
    errors.push({
      field: "model",
      message: "model must be a string",
      value: cfg.model,
    });
  }

  // Validate provider
  if (cfg.provider !== undefined && typeof cfg.provider !== "string") {
    errors.push({
      field: "provider",
      message: "provider must be a string",
      value: cfg.provider,
    });
  }

  // Validate defaultModes
  if (cfg.defaultModes !== undefined) {
    if (
      !Array.isArray(cfg.defaultModes) ||
      !cfg.defaultModes.every((m) => typeof m === "string")
    ) {
      errors.push({
        field: "defaultModes",
        message: "defaultModes must be an array of strings",
        value: cfg.defaultModes,
      });
    }
  }

  // Validate defaultMemoryMode
  if (cfg.defaultMemoryMode !== undefined) {
    if (!VALID_MEMORY_MODES.includes(cfg.defaultMemoryMode as MemoryModeType)) {
      errors.push({
        field: "defaultMemoryMode",
        message: `defaultMemoryMode must be one of: ${VALID_MEMORY_MODES.join(", ")}`,
        value: cfg.defaultMemoryMode,
      });
    }
  }

  // Validate defaultBrowser
  if (
    cfg.defaultBrowser !== undefined &&
    typeof cfg.defaultBrowser !== "boolean"
  ) {
    errors.push({
      field: "defaultBrowser",
      message: "defaultBrowser must be a boolean",
      value: cfg.defaultBrowser,
    });
  }

  // Validate API settings
  if (cfg.proxyUrl !== undefined && typeof cfg.proxyUrl !== "string") {
    errors.push({
      field: "proxyUrl",
      message: "proxyUrl must be a string",
      value: cfg.proxyUrl,
    });
  }

  if (cfg.baseUrl !== undefined && typeof cfg.baseUrl !== "string") {
    errors.push({
      field: "baseUrl",
      message: "baseUrl must be a string",
      value: cfg.baseUrl,
    });
  }

  if (cfg.apiKey !== undefined && typeof cfg.apiKey !== "string") {
    errors.push({
      field: "apiKey",
      message: "apiKey must be a string",
      value: cfg.apiKey,
    });
  }

  if (
    cfg.anthropicApiKey !== undefined &&
    typeof cfg.anthropicApiKey !== "string"
  ) {
    errors.push({
      field: "anthropicApiKey",
      message: "anthropicApiKey must be a string",
      value: cfg.anthropicApiKey,
    });
  }

  if (cfg.geminiApiKey !== undefined && typeof cfg.geminiApiKey !== "string") {
    errors.push({
      field: "geminiApiKey",
      message: "geminiApiKey must be a string",
      value: cfg.geminiApiKey,
    });
  }

  if (
    cfg.ollamaBaseUrl !== undefined &&
    typeof cfg.ollamaBaseUrl !== "string"
  ) {
    errors.push({
      field: "ollamaBaseUrl",
      message: "ollamaBaseUrl must be a string",
      value: cfg.ollamaBaseUrl,
    });
  }

  // Validate logging
  if (
    cfg.logLevel !== undefined &&
    !VALID_LOG_LEVELS.includes(cfg.logLevel as string as any)
  ) {
    errors.push({
      field: "logLevel",
      message: `logLevel must be one of: ${VALID_LOG_LEVELS.join(", ")}`,
      value: cfg.logLevel,
    });
  }

  if (cfg.showTokens !== undefined && typeof cfg.showTokens !== "boolean") {
    errors.push({
      field: "showTokens",
      message: "showTokens must be a boolean",
      value: cfg.showTokens,
    });
  }

  return errors;
}
