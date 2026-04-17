import type { Command, CommandContext } from "../../commands.ts";
import {
  listModelsForProvider,
  resolveModelOption,
  initializeModelFromConfig,
  PRIMARY_PROVIDERS,
  PROVIDER_DEFAULT_BASE_URLS,
  type PrimaryProvider,
} from "../../models/catalog.ts";
import { saveConfig } from "../../config/config-writer.ts";
import type { SelectOption } from "../../state/AppStateStore.ts";
import type { ModelOption } from "../../types.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map a primary provider name to its ProviderType string. */
function providerTypeFor(
  provider: PrimaryProvider,
): ModelOption["providerType"] {
  const map: Record<PrimaryProvider, ModelOption["providerType"]> = {
    OpenAI: "openai",
    Claude: "anthropic",
    Gemini: "google",
    Ollama: "ollama",
  };
  return map[provider];
}

/** Post a chat-style message to the REPL message list. */
function postMessage(context: CommandContext, content: string) {
  context.setAppState((prev) => ({
    ...prev,
    messages: [...prev.messages, { role: "assistant" as const, content }],
  }));
}

// ── Step 3 — baseUrl prompt ───────────────────────────────────────────────────

function openBaseUrlPrompt(
  context: CommandContext,
  model: ModelOption,
  provider: PrimaryProvider,
) {
  const defaultUrl = PROVIDER_DEFAULT_BASE_URLS[provider];

  context.setAppState((prev) => ({
    ...prev,
    prompter: {
      type: "input",
      label: `Base URL  (${provider})`,
      placeholder: defaultUrl || "Leave empty to use provider SDK default",
      initialValue: model.baseUrl ?? defaultUrl,
      onSubmit: (rawUrl: string) => {
        const url = rawUrl.trim() || defaultUrl;
        // If the user chose a non-native Ollama URL (e.g. a LiteLLM proxy), the
        // downstream endpoint speaks OpenAI-compatible protocol, not the native
        // Ollama /api/chat format.  Switch providerType so the right client is used.
        const normalizedUrl = url.trim().toLowerCase();
        const isNativeOllamaUrl =
          normalizedUrl.length === 0 || !normalizedUrl.includes("/v1");
        const isProxiedOllama =
          provider === "Ollama" && url && !isNativeOllamaUrl;
        const finalModel: ModelOption = {
          ...model,
          baseUrl: url || undefined,
          providerType: isProxiedOllama
            ? "openai-compatible"
            : model.providerType,
        };
        context.session.setModel(finalModel);
        // Persist to ~/.ryftrc so the selection survives restarts
        try {
          saveConfig(
            {
              model: finalModel.id,
              provider: finalModel.providerType ?? provider.toLowerCase(),
              ...(finalModel.providerType === "ollama"
                ? { ollamaBaseUrl: url || undefined }
                : finalModel.providerType === "anthropic" ||
                    finalModel.providerType === "google"
                  ? {}
                  : { baseUrl: url || undefined }),
            },
            { backup: false },
          );
        } catch {
          // Non-fatal — session is still updated
        }
        context.setAppState((p) => ({
          ...p,
          currentModel: finalModel,
          messages: [
            ...p.messages,
            {
              role: "assistant" as const,
              content: `✓ Model set to: ${finalModel.label} (${finalModel.id})${url ? `\n  Base URL: ${url}` : ""}`,
            },
          ],
        }));
      },
      onCancel: () => openProviderPicker(context),
    },
  }));
}

// ── Step 2b — custom model name input ────────────────────────────────────────

function openCustomModelInput(
  context: CommandContext,
  provider: PrimaryProvider,
) {
  context.setAppState((prev) => ({
    ...prev,
    prompter: {
      type: "input",
      label: `Custom model id  (${provider})`,
      placeholder: "e.g. gemma4:12b  or  claude-3-7-sonnet-latest",
      initialValue: "",
      onSubmit: (rawId: string) => {
        const id = rawId.trim();
        if (!id) {
          postMessage(context, "No model id entered. Selection cancelled.");
          return;
        }
        // Build a ModelOption using prefix-detection, then force the chosen provider
        const base = initializeModelFromConfig(id);
        const model: ModelOption = {
          ...base,
          providerType: providerTypeFor(provider),
          nativeToolSupport: true,
          baseUrl:
            PROVIDER_DEFAULT_BASE_URLS[provider] || base.baseUrl || undefined,
        };
        openBaseUrlPrompt(context, model, provider);
      },
      onCancel: () => openModelPicker(context, provider),
    },
  }));
}

// ── Step 2 — model picker for a provider ─────────────────────────────────────

function openModelPicker(context: CommandContext, provider: PrimaryProvider) {
  const catalogModels = listModelsForProvider(provider);

  const options: SelectOption<string>[] = [
    ...catalogModels.map((m) => ({
      label: m.label,
      value: m.id,
      description: m.description,
    })),
    {
      label: "Enter custom model name…",
      value: "__custom__",
      description: "Type any model id supported by this provider",
    },
  ];

  const currentId = context.appState.currentModel.id;
  const initialFocusIndex = Math.max(
    0,
    options.findIndex((o) => o.value === currentId),
  );

  context.setAppState((prev) => ({
    ...prev,
    selector: {
      type: "select",
      title: `${provider} — select a model`,
      options,
      initialFocusIndex,
      onSelect: (modelId: string) => {
        if (modelId === "__custom__") {
          openCustomModelInput(context, provider);
          return;
        }
        const found = resolveModelOption(modelId);
        if (found) {
          openBaseUrlPrompt(context, found, provider);
        }
      },
      onCancel: () => openProviderPicker(context),
    },
  }));
}

// ── Step 1 — provider picker ──────────────────────────────────────────────────

function openProviderPicker(context: CommandContext) {
  const providerOptions: SelectOption<string>[] = PRIMARY_PROVIDERS.map(
    (p) => ({
      label: p,
      value: p,
      description: PROVIDER_DEFAULT_BASE_URLS[p] || "API key required",
    }),
  );

  context.setAppState((prev) => ({
    ...prev,
    selector: {
      type: "select",
      title: "Select a provider",
      options: providerOptions,
      initialFocusIndex: 0,
      onSelect: (provider: string) => {
        openModelPicker(context, provider as PrimaryProvider);
      },
      onCancel: () => {
        postMessage(context, "Model selection cancelled.");
      },
    },
  }));
}

// ── Command definition ────────────────────────────────────────────────────────

export const model: Command = {
  name: "model",
  aliases: ["m"],
  description: "Select AI model and provider",

  execute(args: string[], context: CommandContext) {
    const modelArg = args.join(" ").trim();

    if (modelArg) {
      // Direct argument — resolve immediately (unchanged behaviour)
      const found = resolveModelOption(modelArg);
      if (found) {
        context.session.setModel(found);
        try {
          saveConfig(
            {
              model: found.id,
              provider: found.providerType ?? "openai",
              ...(found.providerType === "ollama"
                ? { ollamaBaseUrl: found.baseUrl || undefined }
                : found.providerType === "anthropic" ||
                    found.providerType === "google"
                  ? {}
                  : { baseUrl: found.baseUrl || undefined }),
            },
            { backup: false },
          );
        } catch {
          // Non-fatal — session is still updated
        }
        context.setAppState((prev) => ({
          ...prev,
          currentModel: found,
          messages: [
            ...prev.messages,
            {
              role: "assistant" as const,
              content: `✓ Model switched to: ${found.label} (${found.id})`,
            },
          ],
        }));
      } else {
        postMessage(
          context,
          `Model not found: "${modelArg}"\n\nUse /model (no args) to browse providers interactively.`,
        );
      }
      return;
    }

    // No argument — open the 3-step interactive picker
    openProviderPicker(context);
  },
};
