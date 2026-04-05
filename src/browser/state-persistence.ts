import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BrowserState } from "./mcp-server.ts";
import type { BrowserLifecycleManager } from "./lifecycle.ts";

/**
 * Browser state persistence layer for /compact
 * Stores browser state in .ryft/.browser-state.json during session
 */
export class BrowserStatePersistence {
  private stateDir: string;
  private stateFile: string;

  constructor(compactDir: string = ".ryft") {
    this.stateDir = compactDir;
    this.stateFile = join(this.stateDir, ".browser-state.json");
  }

  /**
   * Save browser state before /compact
   */
  async save(state: BrowserState): Promise<void> {
    try {
      await writeFile(this.stateFile, JSON.stringify(state, null, 2), "utf-8");
    } catch (error) {
      throw new Error(
        `Failed to save browser state: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Load browser state after /compact
   */
  async load(): Promise<BrowserState | null> {
    try {
      const content = await readFile(this.stateFile, "utf-8");
      return JSON.parse(content) as BrowserState;
    } catch {
      // File doesn't exist or is invalid - return null for fresh start
      return null;
    }
  }

  /**
   * Delete persisted state when session ends
   */
  async delete(): Promise<void> {
    try {
      await import("node:fs/promises").then((fs) => fs.unlink(this.stateFile));
    } catch {
      // File might not exist, ignore
    }
  }
}

/**
 * Compact lifecycle hooks for browser state persistence
 * Called during /compact to capture and restore state
 */
export class CompactBrowserManager {
  constructor(
    private persistence: BrowserStatePersistence,
    private lifecycle: BrowserLifecycleManager,
  ) {}

  /**
   * Called before /compact to save browser state
   */
  async beforeCompact(): Promise<void> {
    const state = await this.lifecycle.captureState();
    if (state.urls && state.urls.length > 0) {
      await this.persistence.save(state);
    }
  }

  /**
   * Called after /compact to restore browser state
   */
  async afterCompact(): Promise<void> {
    const state = await this.persistence.load();
    if (state) {
      await this.lifecycle.restoreState(state);
    }
  }

  /**
   * Called when session ends to clean up
   */
  async onSessionEnd(): Promise<void> {
    await this.persistence.delete();
  }
}
