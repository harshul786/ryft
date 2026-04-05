import prompts from "prompts";
import chalk from "chalk";

/**
 * Prompt user for OpenAI API key
 */
export async function promptForApiKey(): Promise<string> {
  console.log(chalk.cyan("\n" + "─".repeat(80)));
  console.log(chalk.bold("Step 1: Configure OpenAI API Key"));
  console.log(chalk.dim("─".repeat(80)));
  console.log(chalk.dim("Your API key will be saved locally to ~/.ryftrc"));
  console.log(
    chalk.dim("Get your key from: https://platform.openai.com/api-keys\n"),
  );

  const response = await prompts(
    {
      type: "invisible",
      name: "apiKey",
      message: "Enter your OpenAI API key (sk-...)",
      validate: (value: string) => {
        if (!value) return "API key is required";
        if (!value.startsWith("sk-")) {
          return 'API key should start with "sk-"';
        }
        if (value.length < 10) {
          return "API key seems too short";
        }
        return true;
      },
    },
    { onCancel: () => process.exit(0) },
  );

  if (!response.apiKey) {
    throw new Error("API key required for setup");
  }

  return response.apiKey;
}

/**
 * Prompt user for model setup choice: quick (presets) or manual (proxy)
 */
export async function promptForModelSetup(): Promise<"quick" | "manual"> {
  console.log(chalk.cyan("\n" + "─".repeat(80)));
  console.log(chalk.bold("Step 2: Choose Model Configuration"));
  console.log(chalk.dim("─".repeat(80)));
  console.log(chalk.dim("Quick: Use OpenAI default models"));
  console.log(chalk.dim("Manual: Configure a custom proxy or API endpoint\n"));

  const response = await prompts(
    {
      type: "select",
      name: "setupType",
      message: "How would you like to set up your model?",
      choices: [
        {
          title: chalk.green("Quick Setup (OpenAI)"),
          value: "quick",
          description: "Use gpt-4o, gpt-4, gpt-3.5-turbo",
        },
        {
          title: chalk.blue("Manual Setup (Custom Proxy)"),
          value: "manual",
          description: "Enter custom API endpoint",
        },
      ],
    },
    { onCancel: () => process.exit(0) },
  );

  return response.setupType;
}

/**
 * Prompt user for mode selection (multi-select)
 */
export async function promptForModes(): Promise<string[]> {
  console.log(chalk.cyan("\n" + "─".repeat(80)));
  console.log(chalk.bold("Step 3: Select Modes"));
  console.log(chalk.dim("─".repeat(80)));
  console.log(chalk.dim("Modes activate different capabilities and tools"));
  console.log(chalk.dim("Select at least one, or press Esc to skip\n"));

  const response = await prompts(
    {
      type: "multiselect",
      name: "modes",
      message: "Which modes would you like to use?",
      choices: [
        {
          title: "Coder",
          value: "coder",
          description: "General coding assistance",
          selected: true,
        },
        {
          title: "Browser Surff",
          value: "browser-surff",
          description: "Web browsing and automation",
        },
        {
          title: "Debugger",
          value: "debugger",
          description: "Debugging tools and analysis",
        },
        {
          title: "Shared",
          value: "shared",
          description: "Shared utilities and helpers",
        },
      ],
    },
    { onCancel: () => ["coder"] },
  );

  if (!response.modes || response.modes.length === 0) {
    return ["coder"]; // default to coder
  }

  return response.modes;
}

/**
 * Show onboarding welcome banner
 */
export function showWelcomeBanner(): void {
  console.clear();
  console.log(chalk.bold.cyan("\n" + "╔" + "═".repeat(78) + "╗"));
  console.log(chalk.bold.cyan("║") + " ".repeat(78) + chalk.bold.cyan("║"));
  console.log(
    chalk.bold.cyan("║") +
      chalk.bold(
        "  Welcome to Ryft v0.1.0 - Lean OpenAI-native ai-code CLI".padEnd(78),
      ) +
      chalk.bold.cyan("║"),
  );
  console.log(
    chalk.bold.cyan("║") +
      chalk.dim(
        "  First time? Let's set up your configuration in 3 minutes.".padEnd(
          78,
        ),
      ) +
      chalk.bold.cyan("║"),
  );
  console.log(chalk.bold.cyan("║") + " ".repeat(78) + chalk.bold.cyan("║"));
  console.log(chalk.bold.cyan("╚" + "═".repeat(78) + "╝\n"));
}

/**
 * Show onboarding summary
 */
export function showOnboardingSummary(
  apiKey: string,
  modelSetup: "quick" | "manual",
  modes: string[],
): void {
  console.log(chalk.cyan("\n" + "─".repeat(80)));
  console.log(chalk.bold("Onboarding Complete"));
  console.log(chalk.dim("─".repeat(80)));
  console.log(chalk.green("✓ API Key configured"));
  console.log(
    chalk.green(
      `✓ Model setup: ${modelSetup === "quick" ? "OpenAI (quick)" : "Custom proxy (manual)"}`,
    ),
  );
  console.log(chalk.green(`✓ Modes selected: ${modes.join(", ")}`));
  console.log(chalk.dim("\nSettings saved to ~/.ryftrc"));
  console.log(chalk.cyan("You can change these anytime with:"));
  console.log(chalk.dim("  /config view    - See all settings"));
  console.log(chalk.dim("  /config set     - Change a setting"));
  console.log(chalk.dim("  /model          - Switch models"));
  console.log(chalk.dim("  /mode           - Switch modes\n"));
}

/**
 * Show skip message
 */
export function showSkipMessage(): void {
  console.log(chalk.yellow("\n" + "─".repeat(80)));
  console.log(chalk.yellow("⚠ Onboarding skipped"));
  console.log(chalk.dim("─".repeat(80)));
  console.log(chalk.dim("You can configure settings later:"));
  console.log(chalk.dim("  /config set apiKey <your-key>  - Set API key"));
  console.log(chalk.dim("  /model                         - Choose a model"));
  console.log(chalk.dim("  /mode                          - Select modes"));
  console.log(chalk.dim("Or run onboarding again next time\n"));
}
