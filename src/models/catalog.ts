import chalk from "chalk";
import type { ModelOption } from "../types.ts";

export interface ModelProviderGroup {
  provider: string;
  description: string;
  models: ModelOption[];
}

const MODEL_GROUPS: ModelProviderGroup[] = [
  {
    provider: "OpenAI",
    description:
      "OpenAI-hosted models for direct use or via an OpenAI-compatible proxy.",
    models: [
      {
        id: "gpt-4.1",
        label: "GPT-4.1",
        provider: "OpenAI",
        description: "Balanced general-purpose model for code and analysis.",
        baseUrl: "https://api.openai.com/v1",
        aliases: [
          "4.1",
          "openai/gpt-4.1",
          "openai:gpt-4.1",
          "gpt-4o",
          "openai:gpt-4o",
          "openai/gpt-4o",
        ],
      },
      {
        id: "gpt-4.1-mini",
        label: "GPT-4.1 Mini",
        provider: "OpenAI",
        description: "Faster and cheaper model for lightweight coding work.",
        baseUrl: "https://api.openai.com/v1",
        aliases: [
          "mini",
          "openai/gpt-4.1-mini",
          "openai:gpt-4.1-mini",
          "openai:gpt-4o-mini",
          "openai/gpt-4o-mini",
          "gpt-4o-mini",
        ],
      },
      {
        id: "gpt-4.1-nano",
        label: "GPT-4.1 Nano",
        provider: "OpenAI",
        description: "Smallest option for quick, low-cost tasks.",
        baseUrl: "https://api.openai.com/v1",
        aliases: ["nano", "openai/gpt-4.1-nano"],
      },
    ],
  },
  {
    provider: "Local Proxy",
    description: "Models routed through the local OpenAI-compatible proxy.",
    models: [
      {
        id: "local/gpt-4.1-mini",
        label: "Local GPT-4.1 Mini",
        provider: "Local Proxy",
        description: "Use the project proxy with a compact coding profile.",
        baseUrl: "http://127.0.0.1:8787/v1",
        aliases: ["local", "proxy", "local/gpt-4.1-mini"],
      },
      {
        id: "local/custom",
        label: "Custom Proxy Model",
        provider: "Local Proxy",
        description: "Use the current proxy base URL with a custom model name.",
        baseUrl: "http://127.0.0.1:8787/v1",
        aliases: ["custom", "proxy/custom"],
      },
    ],
  },
];

export function listModelGroups(): ModelProviderGroup[] {
  return MODEL_GROUPS.map((group) => ({
    ...group,
    models: group.models.map((model) => ({ ...model })),
  }));
}

export function listModelOptions(): ModelOption[] {
  return MODEL_GROUPS.flatMap((group) => group.models);
}

export function findModelOption(input: string): ModelOption | undefined {
  const normalized = input.trim().toLowerCase();
  return listModelOptions().find((option) => {
    const candidates = [
      option.id,
      option.label,
      `${option.provider}/${option.id}`,
      ...(option.aliases ?? []),
    ].map((candidate) => candidate.toLowerCase());
    return candidates.includes(normalized);
  });
}

export function defaultModelOption(): ModelOption {
  return listModelOptions()[0]!;
}

export function resolveModelOption(
  input: string | undefined,
): ModelOption | null {
  const value = input?.trim();
  if (!value) return defaultModelOption();

  if (/^\d+$/.test(value)) {
    const index = Number(value) - 1;
    const options = listModelOptions();
    if (index >= 0 && index < options.length) {
      return options[index]!;
    }
  }

  return findModelOption(value) ?? null;
}

export function formatModelPicker(currentId?: string): string {
  const lines: string[] = ["Available models:"];
  let index = 1;
  for (const group of MODEL_GROUPS) {
    lines.push("");
    lines.push(chalk.bold(group.provider));
    lines.push(chalk.dim(group.description));
    for (const model of group.models) {
      const selected = model.id === currentId ? chalk.green(" [current]") : "";
      lines.push(
        `${index}. ${model.label} ${chalk.dim(`(${model.id})`)} - ${model.description}${selected}`,
      );
      index += 1;
    }
  }
  lines.push("");
  lines.push(
    "Type a number or model id to select it, or press Enter to keep the current model.",
  );
  return lines.join("\n");
}

/**
 * Initialize model from config with validation and fallback
 * TODO #8: Config-aware model initialization
 */
export function initializeModelFromConfig(configModel?: string): ModelOption {
  if (!configModel) {
    // No model in config, use default
    const defaultModel = defaultModelOption();
    console.log(chalk.dim(`Using default model: ${defaultModel.label}`));
    return defaultModel;
  }

  // Try to resolve the configured model
  const resolved = resolveModelOption(configModel);
  if (resolved) {
    console.log(chalk.dim(`Using configured model: ${resolved.label}`));
    return resolved;
  }

  // Fallback to default if configured model not found
  console.warn(
    chalk.yellow(
      `Warning: Configured model '${configModel}' not found, using default`,
    ),
  );
  const defaultModel = defaultModelOption();
  console.log(chalk.dim(`Using default model: ${defaultModel.label}`));
  return defaultModel;
}

/**
 * Format grouped provider display with title
 * Used for interactive picker display
 */
export function formatGroupedProviders(): string {
  const lines: string[] = [chalk.bold("Model Providers:"), ""];

  for (const group of MODEL_GROUPS) {
    lines.push(chalk.cyan(group.provider));
    lines.push(chalk.dim(group.description));
    for (const model of group.models) {
      lines.push(
        `  • ${model.label} ${chalk.dim(`(${model.id})`)} - ${model.description}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format model selection result for display
 */
export function formatModelSelection(model: ModelOption): string {
  return chalk.green(
    `✓ Selected: ${model.label} (${model.id}) - ${model.provider}`,
  );
}
