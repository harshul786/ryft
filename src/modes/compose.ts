import type { Mode } from '../types.ts';

export function buildModePrompt(modes: Mode[], cwd?: string): string {
  const lines = [
    'Mode pack instructions:',
    ...modes.map(mode => {
      let prompt = `- ${mode.name}: ${mode.prompt}`;
      
      // Add context about current working directory for code-related modes
      if ((mode.name === 'coder' || mode.name === 'debugger') && cwd) {
        prompt += ` (Current working directory: ${cwd})`;
      }
      
      return prompt;
    }),
    'When modes conflict, prefer the first selected mode.',
  ];
  return lines.join('\n');
}
