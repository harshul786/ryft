import chalk from "chalk";
import type { ConfigFile } from "../config/types.ts";
import { loadConfig } from "../config/config-loader.ts";
import { saveConfig } from "../config/config-writer.ts";
import type { ModelOption } from "../types.ts";

export interface SavedModelEntry {
  id: string;
  provider: string;
  baseUrl: string;
  label: string;
  apiKey?: string;
}

/**
 * Convert a saved model entry to ModelOption for use in session
 */
export function savedModelToOption(entry: SavedModelEntry): ModelOption {
  return {
    id: entry.id,
    label: entry.label,
    provider: entry.provider,
    description: `Custom proxy: ${entry.baseUrl}`,
    baseUrl: entry.baseUrl,
    aliases: [`saved/${entry.id}`, entry.label.toLowerCase()],
  };
}

/**
 * Get all saved models from global and workspace configs
 */
export function getSavedModels(): SavedModelEntry[] {
  const config = loadConfig();
  const allSaved = [...(config.savedModels ?? [])];

  // Deduplicate by id (workspace overrides global)
  const deduped = new Map<string, SavedModelEntry>();
  allSaved.reverse().forEach((model) => {
    if (!deduped.has(model.id)) {
      deduped.set(model.id, model);
    }
  });

  return Array.from(deduped.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

/**
 * Add or update a saved model in the config
 */
export async function saveSingleModel(
  entry: SavedModelEntry,
  options?: { target?: "global" | "workspace"; backup?: boolean },
): Promise<void> {
  const config = loadConfig();
  const savedModels = [...(config.savedModels ?? [])];

  // Remove existing entry with same id
  const existing = savedModels.findIndex((m) => m.id === entry.id);
  if (existing >= 0) {
    savedModels.splice(existing, 1);
  }

  // Add new entry
  savedModels.push(entry);

  // Save back to config
  await saveConfig(
    { savedModels },
    { target: options?.target ?? "global", backup: options?.backup ?? true },
  );
}

/**
 * Add multiple saved models
 */
export async function saveBatchModels(
  entries: SavedModelEntry[],
  options?: { target?: "global" | "workspace"; backup?: boolean },
): Promise<void> {
  const config = loadConfig();
  let savedModels = [...(config.savedModels ?? [])];

  // Add/update entries
  for (const entry of entries) {
    const existing = savedModels.findIndex((m) => m.id === entry.id);
    if (existing >= 0) {
      savedModels[existing] = entry;
    } else {
      savedModels.push(entry);
    }
  }

  // Save back to config
  await saveConfig(
    { savedModels },
    { target: options?.target ?? "global", backup: options?.backup ?? true },
  );
}

/**
 * Delete a saved model
 */
export async function deleteSavedModel(
  modelId: string,
  options?: { target?: "global" | "workspace"; backup?: boolean },
): Promise<boolean> {
  const config = loadConfig();
  const savedModels = [...(config.savedModels ?? [])];

  const index = savedModels.findIndex((m) => m.id === modelId);
  if (index < 0) {
    return false;
  }

  savedModels.splice(index, 1);

  await saveConfig(
    { savedModels },
    { target: options?.target ?? "global", backup: options?.backup ?? true },
  );

  return true;
}

/**
 * List all saved models in a formatted way
 */
export function formatSavedModelsList(): string {
  const saved = getSavedModels();

  if (saved.length === 0) {
    return chalk.dim("(no saved models yet)\n");
  }

  const lines = [
    chalk.bold("Saved Models:"),
    ...saved.map(
      (m, i) =>
        `  ${i + 1}. ${chalk.cyan(m.label)} ${chalk.dim(`[${m.id}]`)}\n     ${chalk.gray(m.baseUrl)}`,
    ),
    "",
  ];

  return lines.join("\n");
}

/**
 * Validate proxy URL format
 */
export function isValidProxyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Must have http or https protocol
    return /^https?:$/.test(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Extract origin and path from proxy URL
 */
export function parseProxyUrl(
  url: string,
): { origin: string; modelPath: string } | null {
  try {
    const parsed = new URL(url);
    // Standard format: http://host:port/v1 or http://host/v1/models
    const origin = `${parsed.protocol}//${parsed.host}`;
    const pathMatch =
      parsed.pathname.match(/^(\/v\d+)/) ||
      parsed.pathname.match(/^(\/.*?\/v\d+)/);
    const modelPath = pathMatch ? pathMatch[1] : "/v1";

    return { origin, modelPath };
  } catch {
    return null;
  }
}

/**
 * Generate a model ID from label (sanitize for use as identifier)
 */
export function generateModelId(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "custom-model"
  );
}
