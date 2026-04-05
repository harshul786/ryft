import type { Command, CommandContext } from "../../commands.ts";
import chalk from "chalk";
import { saveConfig } from "../../config/config-writer.ts";
import { loadConfig } from "../../config/config-loader.ts";
import { initializeModelFromConfig } from "../../models/catalog.ts";
import type { ParsedConfig } from "../../config/types.ts";

// Config field definition
interface ConfigField {
  name: string;
  displayName: string;
  currentValue: string;
}

/**
 * Get all editable config fields
 */
function getConfigFields(session: any): ConfigField[] {
  return [
    {
      name: "apiKey",
      displayName: "OpenAI API Key",
      currentValue: session.config.apiKey
        ? `***${session.config.apiKey.slice(-4)}`
        : "(not set)",
    },
    {
      name: "model",
      displayName: "Model ID",
      currentValue: session.config.model?.id || "unknown",
    },
    {
      name: "baseUrl",
      displayName: "Base URL",
      currentValue: session.config.baseUrl || "https://api.openai.com/v1",
    },
    {
      name: "proxyUrl",
      displayName: "Proxy URL",
      currentValue: session.config.proxyUrl || "(not set)",
    },
  ];
}

/**
 * Display current config
 */
function displayConfigSummary(session: any, context: CommandContext) {
  const cfg = session.config;
  const info = {
    "API Key": cfg.apiKey ? "***" : "not set",
    "Model ID": cfg.model?.id || "unknown",
    "Base URL": cfg.baseUrl || "https://api.openai.com/v1",
    "Proxy URL": cfg.proxyUrl || "none",
  };

  context.setAppState((prev) => ({
    ...prev,
    messages: [
      ...prev.messages,
      {
        role: "assistant",
        content: `${chalk.bold("Current Configuration:")}
${Object.entries(info)
  .map(([k, v]) => `  ${chalk.dim(k + ":")} ${v}`)
  .join("\n")}

${chalk.dim("Type /config edit to modify fields")}`,
      },
    ],
  }));
}

/**
 * Display prompt for current field
 */
function showFieldPrompt(
  fields: ConfigField[],
  fieldIndex: number,
  context: CommandContext,
) {
  const field = fields[fieldIndex];
  context.setAppState((prev) => ({
    ...prev,
    messages: [
      ...prev.messages,
      {
        role: "assistant",
        content: `${chalk.bold(`Field ${fieldIndex + 1} of ${fields.length}:`)} ${field.displayName}
${chalk.dim("Current value:")} ${field.currentValue}

${chalk.dim("Reply with:")}
  ${chalk.green("y")} - Change this field
  ${chalk.green("n")} - Keep current value
  ${chalk.green("exit")} - Cancel editing`,
      },
    ],
  }));
}

/**
 * Request new value for field
 */
function askForNewValue(field: ConfigField, context: CommandContext) {
  context.setAppState((prev) => ({
    ...prev,
    messages: [
      ...prev.messages,
      {
        role: "assistant",
        content: `${chalk.bold("Enter new value for " + field.displayName + ":")}
${chalk.dim("Current: " + field.currentValue)}`,
      },
    ],
  }));
}

/**
 * Show summary of changes
 */
function showChangeSummary(
  changes: Map<string, string>,
  fields: ConfigField[],
  context: CommandContext,
) {
  const summary = Array.from(changes.entries())
    .map(([fieldName, newValue]) => {
      const field = fields.find((f) => f.name === fieldName);
      return `  ${field?.displayName}: ${chalk.green(newValue)}`;
    })
    .join("\n");

  context.setAppState((prev) => ({
    ...prev,
    messages: [
      ...prev.messages,
      {
        role: "assistant",
        content: `${chalk.cyan.bold("Configuration Changes:")}
${changes.size > 0 ? summary : chalk.dim("(no changes)")}

${chalk.dim("Reply with:")}
  ${chalk.green("save")} - Save changes
  ${chalk.green("cancel")} - Discard changes`,
      },
    ],
  }));
}

export const config: Command = {
  name: "config",
  aliases: ["cfg"],
  description: "Show current configuration or edit fields interactively",

  async execute(args: string[], context: CommandContext) {
    const session = context.session;
    const appState = context.appState as any;
    const userInput = args.join(" ").trim();
    const userInputLower = userInput.toLowerCase();

    // Check if we're in interactive edit mode
    const editState = appState.configEditState as any;

    if (editState?.active) {
      // We're in the middle of editing - process user response
      const { fieldIndex, fields, changes, expectingValue } = editState;
      const currentField = fields[fieldIndex];

      if (expectingValue) {
        // User is providing a new value for a field
        if (userInput.length === 0) {
          context.setAppState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: "assistant",
                content: chalk.yellow(
                  "Value cannot be empty. Please enter a value.",
                ),
              },
            ],
          }));
          return;
        }

        // Store the change
        changes.set(currentField.name, userInput);

        context.setAppState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              content: `${chalk.green("✓")} ${currentField.displayName} will be updated to: ${chalk.green(userInput)}`,
            },
          ],
        }));

        // Move to next field or finish
        const nextFieldIndex = fieldIndex + 1;
        if (nextFieldIndex < fields.length) {
          // More fields to process
          context.setAppState((prev) => ({
            ...prev,
            configEditState: {
              ...editState,
              fieldIndex: nextFieldIndex,
              expectingValue: false,
            },
          }));
          showFieldPrompt(fields, nextFieldIndex, context);
        } else {
          // All fields done - show summary
          context.setAppState((prev) => ({
            ...prev,
            configEditState: {
              ...editState,
              awaitingSave: true,
              expectingValue: false,
            },
          }));
          showChangeSummary(changes, fields, context);
        }
        return;
      }

      if (editState.awaitingSave) {
        // Waiting for save/cancel decision
        if (userInputLower === "save") {
          // Apply changes
          try {
            // Build the config file update - only include fields that should persist
            const configFileUpdate: any = {};
            for (const [fieldName, newValue] of editState.changes) {
              // Map field names to config file structure
              if (fieldName === "apiKey") {
                configFileUpdate.apiKey = newValue;
              } else if (fieldName === "model") {
                configFileUpdate.model = newValue;
              } else if (fieldName === "baseUrl") {
                configFileUpdate.baseUrl = newValue;
              } else if (fieldName === "proxyUrl") {
                // Handle empty proxyUrl
                configFileUpdate.proxyUrl =
                  newValue === "(not set)" || !newValue ? null : newValue;
              }
            }

            // Save to global config file (~/.ryftrc)
            const savedConfig = saveConfig(configFileUpdate, {
              target: "global",
              backup: true,
            });

            if (!savedConfig) {
              throw new Error(
                "Failed to save config - no response from saveConfig",
              );
            }

            // Log save confirmation
            console.log("[CONFIG] Successfully saved to global config file");

            // Reload configuration from global config file to ensure consistency
            const reloadedConfig = loadConfig();

            // Update session config with reloaded values from global config
            for (const [fieldName, newValue] of editState.changes) {
              if (fieldName === "apiKey" && reloadedConfig.apiKey) {
                context.session.config.apiKey = reloadedConfig.apiKey;
              } else if (fieldName === "model" && reloadedConfig.model) {
                // Use initializeModelFromConfig to properly resolve both built-in and custom models
                const modelStr = String(reloadedConfig.model);
                const resolvedModel = initializeModelFromConfig(modelStr);
                context.session.config.model = resolvedModel;
              } else if (fieldName === "baseUrl" && reloadedConfig.baseUrl) {
                context.session.config.baseUrl = reloadedConfig.baseUrl;
              } else if (fieldName === "proxyUrl") {
                context.session.config.proxyUrl =
                  reloadedConfig.proxyUrl || null;
              }
            }

            context.setAppState((prev) => ({
              ...prev,
              configEditState: undefined,
              messages: [
                ...prev.messages,
                {
                  role: "assistant",
                  content: chalk.green(
                    "✓ Configuration saved successfully to global config (~/.ryftrc)!\nChanges are active in this session and will apply to all new sessions.",
                  ),
                },
              ],
            }));
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            console.error("[CONFIG] Save failed:", errorMsg);

            context.setAppState((prev) => ({
              ...prev,
              configEditState: undefined,
              messages: [
                ...prev.messages,
                {
                  role: "assistant",
                  content: chalk.red(
                    "✗ Failed to save to global config: " + errorMsg,
                  ),
                },
              ],
            }));
          }
        } else if (userInputLower === "cancel") {
          context.setAppState((prev) => ({
            ...prev,
            configEditState: undefined,
            messages: [
              ...prev.messages,
              {
                role: "assistant",
                content: chalk.yellow("Changes discarded."),
              },
            ],
          }));
        } else {
          context.setAppState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: "assistant",
                content: chalk.yellow('Please reply with "save" or "cancel"'),
              },
            ],
          }));
        }
        return;
      }

      // Processing y/n/exit responses
      if (userInputLower === "exit" || userInputLower === "cancel") {
        context.setAppState((prev) => ({
          ...prev,
          configEditState: undefined,
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              content: chalk.yellow("Configuration editing cancelled."),
            },
          ],
        }));
        return;
      }

      if (userInputLower === "y" || userInputLower === "yes") {
        // User wants to change this field
        context.setAppState((prev) => ({
          ...prev,
          configEditState: {
            ...editState,
            expectingValue: true,
          },
        }));
        askForNewValue(currentField, context);
        return;
      }

      if (userInputLower === "n" || userInputLower === "no") {
        // Keep current value, move to next field
        const nextFieldIndex = fieldIndex + 1;
        if (nextFieldIndex < fields.length) {
          context.setAppState((prev) => ({
            ...prev,
            configEditState: {
              ...editState,
              fieldIndex: nextFieldIndex,
            },
          }));
          showFieldPrompt(fields, nextFieldIndex, context);
        } else {
          // All fields processed
          if (editState.changes.size > 0) {
            context.setAppState((prev) => ({
              ...prev,
              configEditState: {
                ...editState,
                awaitingSave: true,
              },
            }));
            showChangeSummary(editState.changes, fields, context);
          } else {
            context.setAppState((prev) => ({
              ...prev,
              configEditState: undefined,
              messages: [
                ...prev.messages,
                {
                  role: "assistant",
                  content: chalk.dim("No changes made."),
                },
              ],
            }));
          }
        }
        return;
      }

      // Invalid input
      context.setAppState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content: chalk.yellow('Please reply with "y", "n", or "exit"'),
          },
        ],
      }));
      return;
    }

    // Not in edit mode - handle main command
    if (args[0] === "edit") {
      // Start interactive editing
      const fields = getConfigFields(session);
      context.setAppState((prev) => ({
        ...prev,
        configEditState: {
          active: true,
          fieldIndex: 0,
          fields,
          changes: new Map(),
          expectingValue: false,
          awaitingSave: false,
        },
      }));

      context.setAppState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content: `${chalk.cyan.bold("Configuration Editor")}
${chalk.dim("━".repeat(60))}`,
          },
        ],
      }));

      showFieldPrompt(fields, 0, context);
    } else {
      // Show current configuration
      displayConfigSummary(session, context);
    }
  },
};
