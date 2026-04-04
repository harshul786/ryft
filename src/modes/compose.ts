import type { Mode } from '../types.ts';

export function buildModePrompt(modes: Mode[]): string {
  const lines = [
    'Mode pack instructions:',
    ...modes.map(mode => `- ${mode.name}: ${mode.prompt}`),
    'When modes conflict, prefer the first selected mode.',
  ];
  return lines.join('\n');
}
