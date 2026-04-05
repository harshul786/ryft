import {
  writeFileSync,
  mkdirSync,
  existsSync,
  readFileSync,
  copyFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { ConfigFile, ParsedConfig } from "./types.ts";
import { validateConfig } from "./types.ts";

interface SaveOptions {
  target?: "global" | "workspace";
  backup?: boolean;
}

/**
 * Merge updates with existing config and save to file
 */
export function saveConfig(
  updates: Partial<ConfigFile>,
  options: SaveOptions = {},
): ParsedConfig {
  const { target = "global", backup = true } = options;
  const targetPath =
    target === "global"
      ? join(homedir(), ".ryftrc")
      : join(process.cwd(), ".ryft.json");

  // Load existing config from target
  let existing: ConfigFile = {};
  try {
    if (existsSync(targetPath)) {
      const content = readFileSync(targetPath, "utf-8");
      existing = JSON.parse(content);
    }
  } catch (error) {
    console.warn(
      `Warning: Could not read existing config at ${targetPath}, proceeding with backup:`,
      error,
    );
  }

  // Merge
  const merged = { ...existing, ...updates };

  // Validate
  const errors = validateConfig(merged);
  if (errors.length > 0) {
    throw new Error(
      `Config validation failed: ${errors.map((e) => `${e.field}: ${e.message}`).join("; ")}`,
    );
  }

  // Backup if requested
  if (backup && existsSync(targetPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${targetPath}.backup-${timestamp}`;
    try {
      copyFileSync(targetPath, backupPath);
      console.log(`Backed up existing config to ${backupPath}`);
    } catch (error) {
      console.warn(`Warning: Could not create backup at ${backupPath}:`, error);
    }
  }

  // Write
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");

  return { ...merged, _source: target, _path: targetPath };
}

/**
 * Delete a specific field from config
 */
export function deleteConfigField(
  field: string,
  target: "global" | "workspace" = "global",
): void {
  const targetPath =
    target === "global"
      ? join(homedir(), ".ryftrc")
      : join(process.cwd(), ".ryft.json");

  let existing: Record<string, any> = {};
  try {
    const fs = require("node:fs");
    if (fs.existsSync(targetPath)) {
      const content = fs.readFileSync(targetPath, "utf-8");
      existing = JSON.parse(content);
    }
  } catch (error) {
    throw new Error(`Failed to read config at ${targetPath}: ${error}`);
  }

  delete existing[field];

  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
}
