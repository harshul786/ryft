import { loadConfig } from "../config/config-loader.ts";
import { saveConfig } from "../config/config-writer.ts";
import type { ConfigFile } from "../config/types.ts";

const PACKAGE_VERSION = "0.1.0";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
  isComplete: boolean;
  condition?: () => boolean; // only show this step if condition is true
}

/**
 * Check if onboarding is needed
 */
export function shouldShowOnboarding(): boolean {
  const config = loadConfig();

  // Skip if already completed in this version
  if (
    config.hasCompletedOnboarding &&
    config.onboardingVersion === PACKAGE_VERSION
  ) {
    return false;
  }

  // Skip if shown too many times (avoid showing it repeatedly)
  const seenCount = config.onboardingSeenCount ?? 0;
  if (seenCount >= 3) {
    return false;
  }

  return true;
}

/**
 * Mark onboarding as completed
 */
export function completeOnboarding(): void {
  saveConfig(
    {
      hasCompletedOnboarding: true,
      onboardingVersion: PACKAGE_VERSION,
    } as ConfigFile,
    { target: "global", backup: true },
  );
}

/**
 * Increment the onboarding seen count
 */
export function incrementOnboardingSeenCount(): void {
  const config = loadConfig();
  const currentCount = config.onboardingSeenCount ?? 0;
  saveConfig(
    {
      onboardingSeenCount: currentCount + 1,
    } as ConfigFile,
    { target: "global", backup: true },
  );
}

/**
 * Get all onboarding steps
 */
export function getOnboardingSteps(): OnboardingStep[] {
  const config = loadConfig();

  return [
    {
      id: "welcome",
      title: "Welcome to Ryft",
      description:
        "Set up your OpenAI API key and configure your preferred model",
      isRequired: true,
      isComplete: !!config.apiKey,
    },
    {
      id: "api-key",
      title: "Configure API Key",
      description: "Enter your OpenAI API key for making requests",
      isRequired: !!(!config.apiKey && !process.env.OPENAI_API_KEY),
      isComplete: !!config.apiKey || !!process.env.OPENAI_API_KEY,
    },
    {
      id: "model-selection",
      title: "Select Model",
      description:
        "Choose between using default OpenAI models or a custom proxy/provider",
      isRequired: false,
      isComplete: !!config.model,
      condition: () => !!config.apiKey || !!process.env.OPENAI_API_KEY,
    },
  ];
}

/**
 * Check if all required onboarding steps are complete
 */
export function isOnboardingComplete(): boolean {
  const steps = getOnboardingSteps();
  const requiredSteps = steps.filter((s) => s.isRequired);
  return requiredSteps.every((s) => s.isComplete);
}
