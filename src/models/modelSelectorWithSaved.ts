import chalk from "chalk";
import readline from "node:readline/promises";
import type { Session } from "../runtime/session.ts";
import type { ModelOption } from "../types.ts";
import { listModelGroups, formatModelSelection } from "./catalog.ts";
import {
  getSavedModels,
  saveSingleModel,
  savedModelToOption,
  isValidProxyUrl,
  generateModelId,
} from "./savedModels.ts";
import { saveConfig } from "../config/config-writer.ts";

/**
 * Display model picker with both built-in and saved models
 */
function formatEnhancedModelPicker(currentModelId: string): string {
  const groups = listModelGroups();
  const saved = getSavedModels();

  let output = chalk.bold("\nAvailable Models:\n");

  // Built-in models
  let index = 1;
  for (const group of groups) {
    output += chalk.blue(`  ${group.provider}\n`);
    for (const model of group.models) {
      const isCurrent = model.id === currentModelId;
      const marker = isCurrent ? chalk.green("●") : " ";
      output += `    ${marker} ${index}. ${chalk.cyan(model.label)}\n`;
      output += `       ${chalk.gray(model.description)}\n`;
      index++;
    }
  }

  // Saved models
  if (saved.length > 0) {
    output += chalk.yellow(`  Saved Models\n`);
    for (const model of saved) {
      const isCurrent = model.id === currentModelId;
      const marker = isCurrent ? chalk.green("●") : " ";
      output += `    ${marker} ${index}. ${chalk.cyan(model.label)} ${chalk.dim(`[${model.id}]`)}\n`;
      output += `       ${chalk.gray(`${model.baseUrl}`)}\n`;
      index++;
    }
  }

  // Add new option
  output += `    ${index}. ${chalk.magenta("+ Add custom proxy model")}\n`;

  return output;
}

/**
 * Interactive model selector with saved models support - uses readline, not prompts
 * Only works when stdin is a TTY (not piped input)
 */
export async function interactiveModelSelectorWithSaved(
  session: Session,
  rl: readline.Interface,
): Promise<ModelOption | null> {
  // Check if stdin is a TTY - if not, return null (non-interactive mode)
  if (!process.stdin.isTTY) {
    console.log(
      chalk.yellow("Interactive mode not available with piped input"),
    );
    return null;
  }

  try {
    // Display current model
    console.log(
      chalk.dim(
        `Current model: ${session.config.model.label} (${session.config.model.id})`,
      ),
    );

    // Build choices array
    const allModels: ModelOption[] = [];
    const groups = listModelGroups();

    for (const group of groups) {
      allModels.push(...group.models);
    }

    const saved = getSavedModels();
    const numBuiltIn = allModels.length;
    const numSaved = saved.length;

    // Display picker
    console.log(formatEnhancedModelPicker(session.config.model.id));

    // Get user input
    const answer = await rl.question(
      chalk.cyan(`Select model (1-${numBuiltIn + numSaved + 1})> `),
    );
    const trimmed = answer.trim();

    if (!trimmed) {
      console.log(chalk.yellow("No selection made, keeping current model."));
      return null;
    }

    const selection = parseInt(trimmed, 10);

    // Handle "Add custom proxy" option
    if (selection === numBuiltIn + numSaved + 1) {
      return await promptForCustomModel(rl);
    }

    // Handle selection from combined list
    if (selection >= 1 && selection <= numBuiltIn) {
      const selected = allModels[selection - 1];
      if (selected) {
        // Display confirmation
        console.log(formatModelSelection(selected));

        // Ask to save to config
        const saveAnswer = await rl.question(
          chalk.cyan("Save to config? (yes/no) [no] > "),
        );
        const shouldSave = saveAnswer.trim().toLowerCase() === "yes";

        if (shouldSave) {
          const targetAnswer = await rl.question(
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
      }
    }

    // Handle selection from saved models
    if (selection > numBuiltIn && selection <= numBuiltIn + numSaved) {
      const savedIndex = selection - numBuiltIn - 1;
      const saved_ = getSavedModels();
      const selectedSaved = saved_[savedIndex];

      if (selectedSaved) {
        const selected = savedModelToOption(selectedSaved);

        // Display confirmation
        console.log(chalk.green(`✓ Selected: ${selectedSaved.label}`));
        console.log(chalk.dim(`  URL: ${selectedSaved.baseUrl}`));
        console.log(chalk.dim(`  Model ID: ${selectedSaved.id}`));

        // Ask to save as default
        const saveAnswer = await rl.question(
          chalk.cyan("Set as default? (yes/no) [no] > "),
        );
        const shouldSave = saveAnswer.trim().toLowerCase() === "yes";

        if (shouldSave) {
          try {
            saveConfig(
              { model: selected.id },
              { target: "global", backup: true },
            );
            console.log(chalk.green("✓ Model saved to config"));
          } catch (error) {
            console.log(
              chalk.yellow(`Warning: Could not save to config: ${error}`),
            );
          }
        }

        return selected;
      }
    }

    console.log(chalk.red(`Invalid selection: ${trimmed}`));
    return null;
  } catch (error) {
    console.log(chalk.red(`Error selecting model: ${error}`));
    return null;
  }
}

/**
 * Prompt for custom proxy model and save it
 */
async function promptForCustomModel(
  rl: readline.Interface,
): Promise<ModelOption | null> {
  try {
    // Get proxy URL
    console.log(chalk.bold("\nAdd Custom Proxy Model"));
    let proxyUrl = "";
    let valid = false;

    while (!valid) {
      proxyUrl = await rl.question(
        chalk.cyan("Proxy URL (e.g., http://localhost:8000/v1)> "),
      );

      if (!proxyUrl.trim()) {
        console.log(chalk.yellow("URL is required"));
        continue;
      }

      if (!isValidProxyUrl(proxyUrl)) {
        console.log(
          chalk.yellow(
            "Invalid URL format. Must be http(s)://host[:port][/path]",
          ),
        );
        continue;
      }

      valid = true;
    }

    // Get model name
    const modelName = await rl.question(
      chalk.cyan("Model name (e.g., gpt-4)> "),
    );

    if (!modelName.trim()) {
      console.log(chalk.yellow("Model name is required"));
      return null;
    }

    // Get friendly label
    const label = await rl.question(
      chalk.cyan(`Friendly label [${modelName}]> `),
    );
    const finalLabel = label.trim() || modelName;

    // Generate ID
    const modelId = generateModelId(finalLabel);

    const provider = extractProviderFromUrl(proxyUrl, "custom-proxy");
    const baseUrl = proxyUrl.endsWith("/") ? proxyUrl.slice(0, -1) : proxyUrl;

    // Save the model
    const entry = {
      id: modelId,
      provider,
      baseUrl,
      label: finalLabel,
    };

    await saveSingleModel(entry, { target: "global", backup: true });

    console.log(chalk.green(`\n✓ Saved custom model: ${finalLabel}`));
    console.log(chalk.dim(`  ID: ${modelId}`));
    console.log(chalk.dim(`  URL: ${baseUrl}`));

    return savedModelToOption(entry);
  } catch (error) {
    console.log(chalk.red(`Error adding custom model: ${error}`));
    return null;
  }
}

/**
 * Extract provider name from proxy URL
 */
function extractProviderFromUrl(url: string, fallback: string): string {
  try {
    const parsed = new URL(url);

    if (parsed.hostname?.includes("openai.com")) {
      return "OpenAI";
    }
    if (parsed.hostname?.includes("anthropic.com")) {
      return "Anthropic";
    }
    if (
      parsed.hostname?.includes("localhost") ||
      parsed.hostname === "127.0.0.1"
    ) {
      return "Local";
    }

    return fallback;
  } catch {
    return fallback;
  }
}
