import prompts from "prompts";
import chalk from "chalk";

/**
 * Prompt for proxy base URL
 */
export async function promptForProxyUrl(): Promise<string> {
  console.log(chalk.cyan("\n" + "─".repeat(80)));
  console.log(chalk.bold("Configure Custom Proxy"));
  console.log(chalk.dim("─".repeat(80)));
  console.log(
    chalk.dim("Enter your proxy server URL (e.g., http://localhost:8000)"),
  );
  console.log(chalk.dim("or an OpenAI-compatible API endpoint\n"));

  const response = await prompts(
    {
      type: "text",
      name: "proxyUrl",
      message: "Proxy URL",
      validate: (value: string) => {
        if (!value) return "URL is required";
        try {
          new URL(value);
          return true;
        } catch {
          return "Invalid URL format";
        }
      },
    },
    { onCancel: () => process.exit(0) },
  );

  if (!response.proxyUrl) {
    throw new Error("Proxy URL required");
  }

  return response.proxyUrl;
}

/**
 * Prompt for model name
 */
export async function promptForModelName(): Promise<string> {
  console.log(chalk.cyan("\n" + "─".repeat(80)));
  console.log(chalk.bold("Model Name"));
  console.log(chalk.dim("─".repeat(80)));
  console.log(
    chalk.dim(
      "Enter the model identifier (e.g., gpt-4-turbo, claude-3-opus)\n",
    ),
  );

  const response = await prompts(
    {
      type: "text",
      name: "modelName",
      message: "Model name",
      validate: (value: string) => {
        if (!value) return "Model name is required";
        if (value.length < 2) return "Model name too short";
        return true;
      },
    },
    { onCancel: () => process.exit(0) },
  );

  if (!response.modelName) {
    throw new Error("Model name required");
  }

  return response.modelName;
}

/**
 * Prompt for model label (human-readable name)
 */
export async function promptForModelLabel(
  defaultName: string = "",
): Promise<string> {
  console.log(chalk.cyan("\n" + "─".repeat(80)));
  console.log(chalk.bold("Model Label (Optional)"));
  console.log(chalk.dim("─".repeat(80)));
  console.log(chalk.dim("Enter a friendly name for this configuration\n"));

  const response = await prompts(
    {
      type: "text",
      name: "label",
      message: 'Label (e.g., "My Local Claude")',
      initial: defaultName,
    },
    { onCancel: () => ({ label: defaultName }) },
  );

  return response.label || defaultName;
}

/**
 * Show proxy setup summary
 */
export function showProxySetupSummary(
  proxyUrl: string,
  modelName: string,
  label: string,
): void {
  console.log(chalk.cyan("\n" + "─".repeat(80)));
  console.log(chalk.bold("Proxy Configuration Summary"));
  console.log(chalk.dim("─".repeat(80)));
  console.log(chalk.dim(`Provider URL:  ${chalk.cyan(proxyUrl)}`));
  console.log(chalk.dim(`Model:         ${chalk.cyan(modelName)}`));
  console.log(chalk.dim(`Label:         ${chalk.cyan(label)}`));
  console.log(chalk.dim(`\nConfiguration will be saved to ~/.ryftrc\n`));
}
