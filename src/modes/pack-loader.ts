import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { getFeatureLogger } from "../logging/index.ts";
import type { ModePackDefinition, ResolvedModePack } from "./pack-types.ts";

// TODO #11: Load mode-pack definitions from packs directory
// Scans pack directories and loads their definitions
export function loadModePackDefinitions(
  baseDir: string = process.cwd(),
): ResolvedModePack[] {
  const log = getFeatureLogger("PackLoader");
  const packsDir = join(baseDir, "packs");

  if (!existsSync(packsDir)) {
    log.warn(`Packs directory not found at ${packsDir}`);
    return [];
  }

  const packs: ResolvedModePack[] = [];

  // List subdirectories in packs/
  const dirEntries = readDirSync(packsDir);
  for (const entry of dirEntries) {
    const packPath = join(packsDir, entry);
    if (!isDirectory(packPath)) continue;

    // Try to load pack.json
    const definitionPath = join(packPath, "pack.json");
    if (existsSync(definitionPath)) {
      try {
        const definition = loadPackDefinition(definitionPath);
        if (definition) {
          packs.push({
            ...definition,
            _packPath: packPath,
            _definitionPath: definitionPath,
          });
        }
      } catch (error) {
        log.warn(`Failed to load pack definition at ${definitionPath}`, {
          error: String(error),
        });
      }
    } else {
      // Pack directory exists but no pack.json - create defaults
      const fallbackDef = createFallbackPackDefinition(entry, packPath);
      packs.push(fallbackDef);
    }
  }

  return packs;
}

/**
 * Load a single pack.json file and parse it
 */
function loadPackDefinition(path: string): ModePackDefinition | null {
  try {
    const content = readFileSync(path, "utf-8");
    const def = JSON.parse(content) as ModePackDefinition;

    // Validate required fields
    if (!def.name) {
      console.warn(
        `Warning: Pack definition at ${path} missing required 'name' field`,
      );
      return null;
    }

    return def;
  } catch (error) {
    throw new Error(`Failed to parse pack definition: ${error}`);
  }
}

/**
 * Create a fallback pack definition for a directory without pack.json
 */
function createFallbackPackDefinition(
  packName: string,
  packPath: string,
): ResolvedModePack {
  return {
    name: packName,
    description: `${packName} mode pack`,
    skillDirectory: join(packPath, "skills"),
    skills: [],
    mcpServers: [],
    memory: "claude-like",
    _packPath: packPath,
    _definitionPath: join(packPath, "pack.json"),
  };
}

/**
 * Get a pack by name
 */
export function getModePack(
  name: string,
  baseDir?: string,
): ResolvedModePack | undefined {
  const packs = loadModePackDefinitions(baseDir);
  return packs.find((p) => p.name === name);
}

/**
 * Get multiple packs by name
 */
export function getModePacks(
  names: string[],
  baseDir?: string,
): ResolvedModePack[] {
  const packs = loadModePackDefinitions(baseDir);
  return names
    .map((name) => packs.find((p) => p.name === name))
    .filter((p): p is ResolvedModePack => !!p);
}

/**
 * List all available packs
 */
export function listModePacks(baseDir?: string): ResolvedModePack[] {
  return loadModePackDefinitions(baseDir);
}

// Utility functions for file operations
function readDirSync(path: string): string[] {
  try {
    return readdirSync(path, { withFileTypes: false }) as string[];
  } catch {
    return [];
  }
}

function isDirectory(path: string): boolean {
  try {
    const stat = statSync(path);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
