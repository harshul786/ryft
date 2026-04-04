import type { MemoryMode } from '../types.ts';
import { loadMemoryContent, type MemoryContext } from './store.ts';

export interface MemoryPromptContext extends MemoryContext {
  memoryMode: MemoryMode;
}

export async function buildMemoryPrompt(context: MemoryPromptContext): Promise<string> {
  const content = await loadMemoryContent(context.memoryMode.name, context);
  return [
    `Memory mode: ${context.memoryMode.name}`,
    context.memoryMode.prompt,
    'Keep memory behavior simple and only preserve information that helps future work.',
    content ? `Memory contents:\n${content}` : 'No persisted memory yet.',
  ].join('\n\n');
}

export function summarizeMemory(memoryMode: MemoryMode): string {
  return `${memoryMode.name}: ${memoryMode.description}`;
}
