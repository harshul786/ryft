import prompts from "prompts";
import chalk from "chalk";
import type { ModelOption } from "../types.ts";

export interface ModelWithMetadata extends ModelOption {
  pricing?: string;
  context?: string;
  recommended?: boolean;
}

/**
 * Get quick model setup options (OpenAI presets)
 */
export function getQuickModelOptions(): ModelWithMetadata[] {
  return [
    {
      id: "openai:gpt-4o",
      label: "GPT-4O",
      description: "Latest, multimodal, fastest for complex tasks",
      provider: "openai",
      pricing: "$5 / $15 per 1M tokens",
      context: "128K context",
      recommended: true,
    },
    {
      id: "openai:gpt-4-turbo",
      label: "GPT-4 Turbo",
      description: "Previous generation, highly capable",
      provider: "openai",
      pricing: "$10 / $30 per 1M tokens",
      context: "128K context",
      recommended: false,
    },
    {
      id: "openai:gpt-4",
      label: "GPT-4",
      description: "Original GPT-4, reliable",
      provider: "openai",
      pricing: "$30 / $60 per 1M tokens",
      context: "8K context",
      recommended: false,
    },
    {
      id: "openai:gpt-3.5-turbo",
      label: "GPT-3.5 Turbo",
      description: "Fast and economical, good for simple tasks",
      provider: "openai",
      pricing: "$0.50 / $1.50 per 1M tokens",
      context: "16K context",
      recommended: false,
    },
  ];
}

/**
 * Select a quick model from OpenAI presets
 */
export async function selectQuickModel(): Promise<ModelWithMetadata> {
  const models = getQuickModelOptions();

  console.log(chalk.cyan("\n" + "─".repeat(80)));
  console.log(chalk.bold("Select a Model"));
  console.log(chalk.dim("─".repeat(80)));

  const choices = models.map((model) => ({
    title: `${model.label}${model.recommended ? chalk.yellow(" ★ recommended") : ""}`,
    value: model.id,
    description: `${model.description} · ${model.pricing}`,
  }));

  const response = await prompts(
    {
      type: "select",
      name: "model",
      message: "Which OpenAI model would you like to use?",
      choices,
      initial: 0, // default to GPT-4O
    },
    { onCancel: () => models[0] },
  );

  const selected = models.find((m) => m.id === response.model);
  if (!selected) {
    return models[0]; // fallback to GPT-4O
  }

  return selected;
}

/**
 * Format model info for display
 */
export function formatModelInfo(
  model: ModelOption & { pricing?: string; context?: string },
): string {
  let info = chalk.cyan(model.label);
  if (model.description) {
    info += "\n  " + chalk.dim(model.description);
  }
  if (model.pricing) {
    info += "\n  " + chalk.gray(`Pricing: ${model.pricing}`);
  }
  if (model.context) {
    info += "\n  " + chalk.gray(`Context: ${model.context}`);
  }
  return info;
}
