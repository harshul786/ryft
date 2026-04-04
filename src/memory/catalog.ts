import type { MemoryMode } from '../types.ts';

const MEMORY_MODES: MemoryMode[] = [
  {
    name: 'claude-like',
    description: 'Claude-style file memory with concise markdown notes.',
    prompt: 'Use file-based memory carefully and keep entries small, durable, and actionable.',
  },
  {
    name: 'hierarchy',
    description: 'Hierarchy.md-first memory for agent-readable navigation.',
    prompt: 'Maintain hierarchy.md files as maps for directories. Favor machine navigation over human prose.',
  },
  {
    name: 'session',
    description: 'Session-only memory for low-overhead runs.',
    prompt: 'Retain only session-local notes and discard them at compaction.',
  },
];

export function listMemoryModes(): MemoryMode[] {
  return MEMORY_MODES.slice();
}

export function defaultMemoryMode(): MemoryMode {
  return MEMORY_MODES[0]!;
}

export function resolveMemoryMode(name: string = 'claude-like'): MemoryMode {
  return MEMORY_MODES.find(mode => mode.name === name) ?? MEMORY_MODES[0]!;
}
