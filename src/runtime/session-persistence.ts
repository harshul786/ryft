import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Session } from "./session.ts";

/**
 * Session persistence layer
 * Saves and restores session state between calls
 */

/**
 * Session state snapshot for persistence
 */
export interface SessionSnapshot {
  // Token tracking
  tokenUsed: number;
  tokenBudget: number;

  // Browser state
  browserState?: {
    urls?: string[];
    lastActiveTabId?: string;
  };

  // Timestamp
  timestamp: number;
}

/**
 * Session persistence manager
 */
export class SessionPersistence {
  private stateDir: string;
  private stateFile: string;

  constructor(baseDir: string = ".ryft") {
    this.stateDir = baseDir;
    this.stateFile = join(this.stateDir, ".session-state.json");
  }

  /**
   * Save session state
   */
  async saveSession(session: Session): Promise<void> {
    try {
      const snapshot: SessionSnapshot = {
        tokenUsed: session.tokenBudget.getTotalTokens(),
        tokenBudget: session.tokenBudget.getSummary().budget,
        timestamp: Date.now(),
      };

      await writeFile(
        this.stateFile,
        JSON.stringify(snapshot, null, 2),
        "utf-8",
      );
    } catch (error) {
      throw new Error(
        `Failed to save session state: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Load session state
   */
  async loadSession(): Promise<SessionSnapshot | null> {
    try {
      const content = await readFile(this.stateFile, "utf-8");
      return JSON.parse(content) as SessionSnapshot;
    } catch {
      // File doesn't exist or is invalid
      return null;
    }
  }

  /**
   * Delete session state
   */
  async deleteSession(): Promise<void> {
    try {
      await import("node:fs/promises").then((fs) => fs.unlink(this.stateFile));
    } catch {
      // File might not exist, ignore
    }
  }

  /**
   * Get session age in milliseconds
   */
  async getSessionAge(): Promise<number | null> {
    const state = await this.loadSession();
    if (!state) {
      return null;
    }

    return Date.now() - state.timestamp;
  }

  /**
   * Check if session is still valid (within 24 hours)
   */
  async isSessionValid(): Promise<boolean> {
    const age = await this.getSessionAge();
    if (age === null) {
      return false;
    }

    // Valid if less than 24 hours old
    return age < 24 * 60 * 60 * 1000;
  }
}

/**
 * Global session persistence instance
 */
let globalPersistence: SessionPersistence | null = null;

/**
 * Get or create global session persistence
 */
export function getGlobalSessionPersistence(
  baseDir?: string,
): SessionPersistence {
  if (!globalPersistence) {
    globalPersistence = new SessionPersistence(baseDir);
  }
  return globalPersistence;
}

/**
 * Reset global persistence
 */
export function resetGlobalSessionPersistence(): void {
  globalPersistence = null;
}
