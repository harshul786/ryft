import chalk from "chalk";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { Session } from "../runtime/session.ts";
import type { ModelOption } from "../types.ts";
import {
  listModelGroups,
  resolveModelOption,
  formatModelPicker,
  formatModelSelection,
} from "./catalog.ts";
import { saveConfig } from "../config/config-writer.ts";

/**
 * Interactive model selector with config persistence
 * TODO #10: Interactive model selector that saves to config
 */
export async function interactiveModelSelector(
  session: Session,
  rl?: readline.Interface,
): Promise<ModelOption | null> {
  const useOwnRl = !rl;
  const interface_: readline.Interface =
    rl ?? readline.createInterface({ input, output });

  try {
    // Display current model
    console.log(
      chalk.dim(
        `Current model: ${session.config.model.label} (${session.config.model.id})`,
      ),
    );
    console.log("");

    // Display picker
    console.log(formatModelPicker(session.config.model.id));

    // Get user input
    const answer = await interface_.question(chalk.cyan("Select model> "));
    const trimmed = answer.trim();

    if (!trimmed) {
      console.log(chalk.yellow("No selection made, keeping current model."));
      return null;
    }

    // Try to resolve the selection
    const selected = resolveModelOption(trimmed);
    if (!selected) {
      console.log(chalk.red(`Unknown model or invalid selection: ${trimmed}`));
      return null;
    }

    // Display confirmation
    console.log(formatModelSelection(selected));

    // Ask to save to config
    const saveAnswer = await interface_.question(
      chalk.cyan("Save to config? (yes/no) [yes] > "),
    );
    const shouldSave = saveAnswer.trim().toLowerCase() !== "no";

    if (shouldSave) {
      const targetAnswer = await interface_.question(
        chalk.cyan("Save to (global/workspace) [global] > "),
      );
      const target =
        targetAnswer.trim().toLowerCase() === "workspace"
          ? "workspace"
          : "global";

      try {
        saveConfig({ model: selected.id }, { target, backup: true });
        console.log(chalk.green(`✓ Model saved to ${target} config`));
      } catch (error) {
        console.log(
          chalk.yellow(`Warning: Could not save to config: ${error}`),
        );
      }
    }

    return selected;
  } finally {
    if (useOwnRl) {
      interface_.close();
    }
  }
}

/**
 * Simple model selector for command-line interface
 * Used when input is provided as arguments
 */
export function selectModelByInput(input: string): ModelOption | null {
  return resolveModelOption(input) ?? null;
}

/**
 * Format model information for display in REPL
 * TODO #9: Model display in REPL
 */
export function formatModelForPrompt(model: ModelOption): string {
  return chalk.magenta(`[${model.provider}/${model.id}]`);
}

/**
 * Format model information for header/banner
 */
export function formatModelForHeader(model: ModelOption): string {
  return chalk.white(`model: ${model.label} (${model.provider})`);
}

/**
 * List all available providers for display
 */
export function listProviders(): Array<{ name: string; modelCount: number }> {
  return listModelGroups().map((group) => ({
    name: group.provider,
    modelCount: group.models.length,
  }));
}
