/**
 * Skill ID Manager
 * 
 * Manages sequential numeric IDs for skills.
 * Each skill gets a unique auto-incremented ID (1, 2, 3...) when created.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ID allocation state stored in a dedicated file
 */
interface IdState {
  nextId: number;
  created: string;
  lastUpdated: string;
}

// In-memory cache of the ID state
let idStateCache: IdState | null = null;

/**
 * Get the ID state file path
 */
function getIdStatePath(): string {
  return join(process.cwd(), '.ryft', 'id-state.json');
}

/**
 * Load the ID state from file or initialize it
 */
function loadIdState(): IdState {
  if (idStateCache) {
    return idStateCache;
  }

  try {
    const idStatePath = getIdStatePath();
    const content = readFileSync(idStatePath, 'utf-8');
    idStateCache = JSON.parse(content) as IdState;
    return idStateCache;
  } catch {
    // Initialize new state if file doesn't exist
    idStateCache = {
      nextId: 1,
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };
    saveIdState(idStateCache);
    return idStateCache;
  }
}

/**
 * Save the ID state to file
 */
function saveIdState(state: IdState): void {
  try {
    const idStatePath = getIdStatePath();
    // Ensure directory exists
    const dir = join(process.cwd(), '.ryft');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    state.lastUpdated = new Date().toISOString();
    writeFileSync(idStatePath, JSON.stringify(state, null, 2), 'utf-8');
    idStateCache = state;
  } catch (error) {
    console.warn(`Failed to save ID state: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get the next available sequential ID
 * 
 * @returns Next ID number (e.g., 1, 2, 3...)
 * 
 * @example
 * const id = getNextSkillId();  // Returns 1
 * const id2 = getNextSkillId(); // Returns 2
 */
export function getNextSkillId(): number {
  const state = loadIdState();
  const currentId = state.nextId;
  
  // Increment and save
  state.nextId = currentId + 1;
  saveIdState(state);
  
  return currentId;
}

/**
 * Get the current maximum ID (highest assigned ID so far)
 * 
 * @returns Current maximum assigned ID (or 0 if none assigned yet)
 * 
 * @example
 * const maxId = getCurrentMaxId(); // Returns 4 if 4 skills exist
 */
export function getCurrentMaxId(): number {
  const state = loadIdState();
  return state.nextId - 1;
}

/**
 * Reset ID counter (useful for testing)
 * 
 * @internal Test utility only - do not use in production
 */
export function resetIdCounter(): void {
  idStateCache = {
    nextId: 1,
    created: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };
  saveIdState(idStateCache);
}

/**
 * Advance ID counter to a specific value
 * 
 * Useful when migrating existing skills to the new ID system.
 * Only advances if newMaxId is higher than current counter.
 * 
 * @param newMaxId - The new maximum ID to set (counter becomes newMaxId + 1)
 * 
 * @example
 * // Migrate 4 existing skills, set counter to 5
 * advanceIdCounterTo(4);
 * const nextId = getNextSkillId(); // Returns 5
 */
export function advanceIdCounterTo(newMaxId: number): void {
  const state = loadIdState();
  if (newMaxId >= state.nextId - 1) {
    state.nextId = newMaxId + 1;
    saveIdState(state);
  }
}

// Import required node modules
import { existsSync, mkdirSync } from 'node:fs';
