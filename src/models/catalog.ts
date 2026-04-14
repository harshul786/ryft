import chalk from "chalk";
import type { ModelOption } from "../types.ts";

export interface ModelProviderGroup {
  provider: string;
  description: string;
  models: ModelOption[];
}

// The 4 primary selectable providers surfaced in the `/model` picker.
export const PRIMARY_PROVIDERS = [
  "OpenAI",
  "Claude",
  "Gemini",
  "Ollama",
] as const;
export type PrimaryProvider = (typeof PRIMARY_PROVIDERS)[number];

/** Default API base URLs surfaced at the baseUrl prompt step. */
export const PROVIDER_DEFAULT_BASE_URLS: Record<PrimaryProvider, string> = {
  OpenAI: "https://api.openai.com/v1",
  Claude: "", // SDK reads ANTHROPIC_API_KEY from env; no baseUrl needed
  Gemini: "", // SDK reads GEMINI_API_KEY / GOOGLE_API_KEY from env; no baseUrl needed
  Ollama: "http://localhost:11434",
};

const MODEL_GROUPS: ModelProviderGroup[] = [
  {
    provider: "OpenAI",
    description: "OpenAI-hosted GPT models. Requires OPENAI_API_KEY.",
    models: [
      {
        id: "gpt-5.4",
        label: "GPT-5.4",
        provider: "OpenAI",
        description: "Latest GPT-5.4 — best reasoning, multimodal, tool use.",
        baseUrl: "https://api.openai.com/v1",
        providerType: "openai",
        nativeToolSupport: true,
        aliases: ["5.4", "openai/gpt-5.4"],
      },
      {
        id: "gpt-5.4-mini",
        label: "GPT-5.4 Mini",
        provider: "OpenAI",
        description: "Fast and cost-efficient variant of GPT-5.4.",
        baseUrl: "https://api.openai.com/v1",
        providerType: "openai",
        nativeToolSupport: true,
        aliases: ["5.4-mini", "openai/gpt-5.4-mini"],
      },
      {
        id: "gpt-5.3-codex",
        label: "GPT-5.3 Codex",
        provider: "OpenAI",
        description: "GPT-5.3 fine-tuned for code generation and completion.",
        baseUrl: "https://api.openai.com/v1",
        providerType: "openai",
        nativeToolSupport: true,
        aliases: ["codex", "openai/gpt-5.3-codex"],
      },
      {
        id: "gpt-4.1",
        label: "GPT-4.1",
        provider: "OpenAI",
        description: "Balanced general-purpose model for code and analysis.",
        baseUrl: "https://api.openai.com/v1",
        providerType: "openai",
        nativeToolSupport: true,
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
        providerType: "openai",
        nativeToolSupport: true,
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
        providerType: "openai",
        nativeToolSupport: true,
        aliases: ["nano", "openai/gpt-4.1-nano"],
      },
    ],
  },
  {
    provider: "Claude",
    description: "Claude models by Anthropic. Requires ANTHROPIC_API_KEY.",
    models: [
      {
        id: "claude-opus-4-6",
        label: "Claude Opus 4.6",
        provider: "Claude",
        description:
          "Most capable Claude — complex reasoning and long context.",
        providerType: "anthropic",
        nativeToolSupport: true,
        supportsThinking: true,
        supportsAdaptiveThinking: true,
        aliases: ["opus", "claude-opus", "anthropic/claude-opus-4-6"],
      },
      {
        id: "claude-sonnet-4-6",
        label: "Claude Sonnet 4.6",
        provider: "Claude",
        description: "Balanced Claude — everyday coding and analysis.",
        providerType: "anthropic",
        nativeToolSupport: true,
        supportsThinking: true,
        supportsAdaptiveThinking: true,
        aliases: ["sonnet", "claude-sonnet", "anthropic/claude-sonnet-4-6"],
      },
      {
        id: "claude-haiku-4-6",
        label: "Claude Haiku 4.6",
        provider: "Claude",
        description: "Fastest, most compact Claude for lightweight tasks.",
        providerType: "anthropic",
        nativeToolSupport: true,
        supportsThinking: true,
        supportsAdaptiveThinking: false,
        aliases: ["haiku", "claude-haiku", "anthropic/claude-haiku-4-6"],
      },
      // Previous generation — kept for compatibility
      {
        id: "claude-opus-4-5",
        label: "Claude Opus 4.5",
        provider: "Claude",
        description: "Previous-gen Opus — strong at complex multi-step tasks.",
        providerType: "anthropic",
        nativeToolSupport: true,
        supportsThinking: true,
        supportsAdaptiveThinking: false,
        aliases: ["opus-4-5", "anthropic/claude-opus-4-5"],
      },
      {
        id: "claude-sonnet-4-5",
        label: "Claude Sonnet 4.5",
        provider: "Claude",
        description: "Previous-gen Sonnet.",
        providerType: "anthropic",
        nativeToolSupport: true,
        supportsThinking: true,
        supportsAdaptiveThinking: false,
        aliases: ["sonnet-4-5", "anthropic/claude-sonnet-4-5"],
      },
      {
        id: "claude-haiku-3-5",
        label: "Claude Haiku 3.5",
        provider: "Claude",
        description: "Previous-gen Haiku.",
        providerType: "anthropic",
        nativeToolSupport: true,
        supportsThinking: true,
        supportsAdaptiveThinking: false,
        aliases: ["haiku-3-5", "anthropic/claude-haiku-3-5"],
      },
    ],
  },
  {
    provider: "Gemini",
    description: "Gemini models by Google. Requires GEMINI_API_KEY.",
    models: [
      {
        id: "gemini-2.5-flash",
        label: "Gemini 2.5 Flash",
        provider: "Gemini",
        description: "Latest Gemini Flash — fast and highly capable.",
        providerType: "google",
        nativeToolSupport: true,
        aliases: ["flash", "gemini-flash", "google/gemini-2.5-flash"],
      },
      {
        id: "gemini-2.5-pro",
        label: "Gemini 2.5 Pro",
        provider: "Gemini",
        description: "Most capable Gemini with strong multimodal support.",
        providerType: "google",
        nativeToolSupport: true,
        aliases: ["gemini-pro", "google/gemini-2.5-pro"],
      },
      {
        id: "gemini-2.5-flash-lite",
        label: "Gemini 2.5 Flash Lite",
        provider: "Gemini",
        description: "Lightweight and efficient for fast tasks.",
        providerType: "google",
        nativeToolSupport: true,
        aliases: ["flash-lite", "google/gemini-2.5-flash-lite"],
      },
      {
        id: "gemini-2.0-flash",
        label: "Gemini 2.0 Flash",
        provider: "Gemini",
        description: "Previous-gen Flash (legacy).",
        providerType: "google",
        nativeToolSupport: true,
        aliases: ["2.0-flash", "google/gemini-2.0-flash"],
      },
    ],
  },
  {
    provider: "Ollama",
    description:
      "Locally-hosted models via Ollama. Must be running on port 11434.",
    models: [
      // Gemma 4 family (prioritised — latest as of April 2026)
      {
        id: "gemma4:31b",
        label: "Gemma 4 31B",
        provider: "Ollama",
        description: "Google's Gemma 4 — largest, strongest local model.",
        baseUrl: "http://localhost:11434",
        providerType: "ollama",
        nativeToolSupport: true,
        aliases: ["gemma4-31b", "ollama/gemma4:31b"],
      },
      {
        id: "gemma4:26b",
        label: "Gemma 4 26B",
        provider: "Ollama",
        description: "Gemma 4 26B — excellent balance of size and quality.",
        baseUrl: "http://localhost:11434",
        providerType: "ollama",
        nativeToolSupport: true,
        aliases: ["gemma4-26b", "ollama/gemma4:26b"],
      },
      {
        id: "gemma4:e4b",
        label: "Gemma 4 E4B",
        provider: "Ollama",
        description: "Gemma 4 E4B — efficient 4-bit quantised variant.",
        baseUrl: "http://localhost:11434",
        providerType: "ollama",
        nativeToolSupport: true,
        aliases: ["gemma4-e4b", "ollama/gemma4:e4b"],
      },
      {
        id: "gemma4:e2b",
        label: "Gemma 4 E2B",
        provider: "Ollama",
        description: "Gemma 4 E2B — smallest Gemma 4, fastest inference.",
        baseUrl: "http://localhost:11434",
        providerType: "ollama",
        nativeToolSupport: true,
        aliases: ["gemma4-e2b", "ollama/gemma4:e2b"],
      },
      // GPT-OSS family
      {
        id: "gpt-oss:20b",
        label: "GPT OSS 20B",
        provider: "Ollama",
        description: "OpenAI's open-source 20B — strong reasoning locally.",
        baseUrl: "http://localhost:11434",
        providerType: "ollama",
        nativeToolSupport: true,
        aliases: ["gpt-oss", "gpt-oss-20b", "ollama/gpt-oss:20b"],
      },
      // Classic models
      {
        id: "mistral",
        label: "Mistral 7B",
        provider: "Ollama",
        description: "Mistral 7B — efficient with strong code support.",
        baseUrl: "http://localhost:11434",
        providerType: "ollama",
        nativeToolSupport: true,
        aliases: ["ollama/mistral"],
      },
      {
        id: "llama3.3",
        label: "Llama 3.3",
        provider: "Ollama",
        description: "Meta's Llama 3.3 — fast general-purpose local model.",
        baseUrl: "http://localhost:11434",
        providerType: "ollama",
        nativeToolSupport: true,
        aliases: ["llama", "llama3", "ollama/llama3.3"],
      },
      {
        id: "qwen2.5-coder",
        label: "Qwen 2.5 Coder",
        provider: "Ollama",
        description: "Qwen 2.5 fine-tuned for code generation.",
        baseUrl: "http://localhost:11434",
        providerType: "ollama",
        nativeToolSupport: true,
        aliases: ["qwen", "qwen-coder", "ollama/qwen2.5-coder"],
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
        providerType: "openai-compatible",
        aliases: ["local", "proxy", "local/gpt-4.1-mini"],
      },
      {
        id: "local/custom",
        label: "Custom Proxy Model",
        provider: "Local Proxy",
        description: "Use the current proxy base URL with a custom model name.",
        baseUrl: "http://127.0.0.1:8787/v1",
        providerType: "openai-compatible",
        aliases: ["custom", "proxy/custom"],
      },
    ],
  },
];

/** Returns models belonging to the given provider group name. */
export function listModelsForProvider(providerName: string): ModelOption[] {
  const group = MODEL_GROUPS.find(
    (g) => g.provider.toLowerCase() === providerName.toLowerCase(),
  );
  return group ? group.models.map((m) => ({ ...m })) : [];
}

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
 * Supports both built-in models and custom external models
 */
export function initializeModelFromConfig(configModel?: string): ModelOption {
  if (!configModel) {
    // No model in config, use default
    const defaultModel = defaultModelOption();
    console.log(chalk.dim(`Using default model: ${defaultModel.label}`));
    return defaultModel;
  }

  // Try to resolve the configured model from built-in list
  const resolved = resolveModelOption(configModel);
  if (resolved) {
    console.log(chalk.dim(`Using configured model: ${resolved.label}`));
    return resolved;
  }

  // Model not found in built-in list - treat as custom/external model
  // This allows users to configure external models (e.g., gemma-lite, ollama models, etc.)
  console.log(chalk.dim(`Using custom external model: ${configModel}`));

  // Infer providerType from model-id prefix so llmClient.ts routes correctly
  let providerType: ModelOption["providerType"] = "openai-compatible";
  let nativeToolSupport = false;
  let baseUrl: string | undefined;

  if (configModel.startsWith("claude-")) {
    providerType = "anthropic";
    nativeToolSupport = true;
  } else if (configModel.startsWith("gemini-")) {
    providerType = "google";
    nativeToolSupport = true;
  } else if (
    configModel.startsWith("ollama/") ||
    configModel.startsWith("ollama:")
  ) {
    providerType = "ollama";
    nativeToolSupport = true;
    baseUrl = "http://localhost:11434";
  }

  // Create a ModelOption for the custom model
  const customModel: ModelOption = {
    id: configModel,
    label: configModel,
    provider: "custom",
    description: `Custom external model: ${configModel}`,
    providerType,
    nativeToolSupport,
    ...(baseUrl ? { baseUrl } : {}),
  };

  return customModel;
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
