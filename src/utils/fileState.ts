/**
 * File State Cache
 *
 * Tracks modification times and content hashes to detect conflicts
 * and prevent writes to files that have been externally modified.
 */

import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";

export interface FileRecord {
  path: string;
  mtime: number;
  hash: string;
  size: number;
}

export class FileStateCache {
  private state = new Map<string, FileRecord>();

  /**
   * Record the state of a file after reading it
   */
  async recordRead(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, "utf-8");
      const stats = await stat(filePath);
      const hash = createHash("sha256").update(content).digest("hex");

      this.state.set(filePath, {
        path: filePath,
        mtime: stats.mtimeMs,
        hash,
        size: stats.size,
      });
    } catch (error) {
      // File doesn't exist or can't be read - that's OK
      // We just won't have a record for it
    }
  }

  /**
   * Check if a file has been modified since it was read
   * Returns true if the file has changed, false if unchanged or not tracked
   */
  async checkModified(filePath: string): Promise<boolean> {
    const record = this.state.get(filePath);
    if (!record) {
      // We don't have a baseline, so we can't detect conflicts
      return false;
    }

    try {
      const stats = await stat(filePath);
      const content = await readFile(filePath, "utf-8");
      const currentHash = createHash("sha256").update(content).digest("hex");

      // Check both mtime and content hash
      const modified =
        stats.mtimeMs !== record.mtime || currentHash !== record.hash;

      return modified;
    } catch (error) {
      // File was deleted or can't be read
      // Consider this a modification
      return true;
    }
  }

  /**
   * Record the state of a file after writing it
   */
  async recordWrite(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, "utf-8");
      const stats = await stat(filePath);
      const hash = createHash("sha256").update(content).digest("hex");

      this.state.set(filePath, {
        path: filePath,
        mtime: stats.mtimeMs,
        hash,
        size: stats.size,
      });
    } catch (error) {
      // File doesn't exist or can't be read - log it
      console.error(`Failed to record state for ${filePath}:`, error);
    }
  }

  /**
   * Clear all tracked state
   */
  clear(): void {
    this.state.clear();
  }

  /**
   * Get the recorded state for a file
   */
  getRecord(filePath: string): FileRecord | undefined {
    return this.state.get(filePath);
  }

  /**
   * List all tracked files
   */
  listTracked(): FileRecord[] {
    return Array.from(this.state.values());
  }
}

// Global singleton instance
export const fileState = new FileStateCache();
