/**
 * Skill Registry Module
 * 
 * Central skill registration with deduplication by realpath.
 * Handles skill caching, discovery, and retrieval with conflict resolution.
 */

import { realpath } from 'node:fs/promises';
import type { Skill } from '../types.ts';

/**
 * Tracks a skill and its source for deduplication
 */
interface RegistryEntry {
  skill: Skill;
  realPath: string;
  source: 'bundled' | 'user' | 'project' | 'mode';
  timestamp: number;
}

/**
 * Skill Registry - manages centralized skill registration and deduplication
 */
export class SkillRegistry {
  private entries: Map<string, RegistryEntry> = new Map();
  private realPathCache: Map<string, string> = new Map();
  private nameIndex: Map<string, string> = new Map(); // name -> realPath mapping
  private loadSignal: ((skills: Skill[]) => void) | null = null;

  /**
   * Register a skill in the registry
   * Deduplicates by realpath; later registrations override earlier ones
   */
  async register(skill: Skill, source: RegistryEntry['source']): Promise<void> {
    if (!skill.file) {
      // For skills without file path, use name + source as unique key
      const key = `${source}:${skill.name}`;
      this.entries.set(key, {
        skill,
        realPath: key,
        source,
        timestamp: Date.now(),
      });
      this.nameIndex.set(skill.name, key);
      return;
    }

    // Resolve to realpath for deduplication
    const realPath = await this.resolveRealPath(skill.file);
    
    // If file already registered, remove old name index entry
    if (this.entries.has(realPath)) {
      const oldEntry = this.entries.get(realPath)!;
      // Remove old name from index if it's different
      if (oldEntry.skill.name !== skill.name) {
        this.nameIndex.delete(oldEntry.skill.name);
      }
    }

    // Check timestamp: only override if new registration is later
    const shouldRegister = !this.entries.has(realPath) || 
      (Date.now() >= (this.entries.get(realPath)?.timestamp ?? 0));

    if (shouldRegister) {
      this.entries.set(realPath, {
        skill,
        realPath,
        source,
        timestamp: Date.now(),
      });
    }

    // Update name index with new skill name
    this.nameIndex.set(skill.name, realPath);
  }

  /**
   * Get a skill by name
   */
  get(name: string): Skill | undefined {
    const realPath = this.nameIndex.get(name);
    if (!realPath) return undefined;
    return this.entries.get(realPath)?.skill;
  }

  /**
   * Get all registered skills
   */
  getAll(): Skill[] {
    return Array.from(this.entries.values())
      .sort((a, b) => a.skill.name.localeCompare(b.skill.name))
      .map(entry => entry.skill);
  }

  /**
   * Get skills from a specific source
   */
  getBySource(source: RegistryEntry['source']): Skill[] {
    return Array.from(this.entries.values())
      .filter(entry => entry.source === source)
      .sort((a, b) => a.skill.name.localeCompare(b.skill.name))
      .map(entry => entry.skill);
  }

  /**
   * Clear all registered skills
   */
  clear(): void {
    this.entries.clear();
    this.nameIndex.clear();
    this.realPathCache.clear();
  }

  /**
   * Get registry size
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Set a callback when skills are loaded
   */
  onLoad(callback: (skills: Skill[]) => void): void {
    this.loadSignal = callback;
  }

  /**
   * Emit load signal
   */
  emitLoad(): void {
    if (this.loadSignal) {
      this.loadSignal(this.getAll());
    }
  }

  /**
   * Resolve file path to realpath for deduplication
   * Caches results to avoid redundant filesystem calls
   */
  private async resolveRealPath(filePath: string): Promise<string> {
    if (this.realPathCache.has(filePath)) {
      return this.realPathCache.get(filePath)!;
    }

    try {
      const resolved = await realpath(filePath);
      this.realPathCache.set(filePath, resolved);
      return resolved;
    } catch {
      // If realpath fails (e.g., file doesn't exist), use path as-is
      this.realPathCache.set(filePath, filePath);
      return filePath;
    }
  }
}

/**
 * Global singleton registry instance
 */
let globalRegistry: SkillRegistry | null = null;

/**
 * Get or create the global skill registry
 */
export function getGlobalSkillRegistry(): SkillRegistry {
  if (!globalRegistry) {
    globalRegistry = new SkillRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global registry (useful for testing)
 */
export function resetGlobalRegistry(): void {
  if (globalRegistry) {
    globalRegistry.clear();
  }
  globalRegistry = null;
}
