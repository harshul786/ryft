import chalk from "chalk";
import type { ConfigFile } from "../config/types.ts";
import type { ModelOption } from "../types.ts";
import {
  shouldShowOnboarding,
  completeOnboarding,
  incrementOnboardingSeenCount,
} from "./onboardingState.ts";
import {
  showWelcomeBanner,
  promptForApiKey,
  promptForModelSetup,
  promptForModes,
  showOnboardingSummary,
  showSkipMessage,
} from "./onboardingPrompts.ts";
import { selectQuickModel } from "./quickModelSetup.ts";
import {
  promptForProxyUrl,
  promptForModelName,
  promptForModelLabel,
  showProxySetupSummary,
} from "./customProxySetup.ts";

export interface OnboardingConfig {
  apiKey: string;
  model: string;
  provider: string;
  baseUrl: string;
  defaultModes: string[];
  savedModels?: Array<{
    id: string;
    provider: string;
    baseUrl: string;
    label: string;
  }>;
}

/**
 * Run complete onboarding flow
 * Returns config object to be saved to ~/.ryftrc, or null if onboarding is not needed
 */
export async function runOnboarding(): Promise<OnboardingConfig | null> {
  // Check if onboarding should run
  if (!shouldShowOnboarding()) {
    return null;
  }

  // Show welcome banner
  showWelcomeBanner();

  let apiKey: string;
  let modelSetupType: "quick" | "manual";
  let modes: string[];

  try {
    // Step 1: Get API key
    apiKey = await promptForApiKey();

    // Step 2: Choose model setup type
    modelSetupType = await promptForModelSetup();

    // Step 3: Get modes
    modes = await promptForModes();

    // Build config based on choices
    let config: OnboardingConfig;

    if (modelSetupType === "quick") {
      // Quick setup: select from OpenAI presets
      const selectedModel = await selectQuickModel();
      config = {
        apiKey,
        model: selectedModel.id,
        provider: selectedModel.provider,
        baseUrl: "https://api.openai.com/v1",
        defaultModes: modes,
      };
      showOnboardingSummary(apiKey, "quick", modes);
    } else {
      // Manual setup: configure custom proxy
      const proxyUrl = await promptForProxyUrl();
      const modelName = await promptForModelName();
      const label = await promptForModelLabel(modelName);

      showProxySetupSummary(proxyUrl, modelName, label);

      // Determine provider from proxy URL
      const provider = extractProviderFromUrl(proxyUrl);
      const modelId = `${provider}:${modelName}`;

      config = {
        apiKey,
        model: modelId,
        provider,
        baseUrl: proxyUrl,
        defaultModes: modes,
        savedModels: [
          {
            id: modelId,
            provider,
            baseUrl: proxyUrl,
            label,
          },
        ],
      };

      showOnboardingSummary(apiKey, "manual", modes);
    }

    // Mark onboarding as completed
    completeOnboarding();

    return config;
  } catch (error) {
    // User cancelled or error occurred
    console.log(chalk.yellow("\nOnboarding cancelled"));
    incrementOnboardingSeenCount();
    showSkipMessage();

    // Return null so app continues with existing saved config
    return null;
  }
}

/**
 * Extract provider name from proxy URL
 * Examples: localhost:8000 → local, openai.com → openai, anthropic.com → anthropic
 */
function extractProviderFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "local";
    }

    // Extract first domain part
    const parts = hostname.split(".");
    const domain = parts[parts.length - 2] || parts[0];

    // Map common domains
    const providerMap: Record<string, string> = {
      openai: "openai",
      anthropic: "anthropic",
      groq: "groq",
      local: "local",
      localhost: "local",
    };

    return providerMap[domain] || domain;
  } catch {
    return "custom";
  }
}
