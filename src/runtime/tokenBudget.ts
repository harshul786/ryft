import { roughTokenEstimate } from './util.ts';

export function applyTokenCap(text: string, maxTokens: number): string {
  const words = String(text).trim().split(/\s+/);
  let out = '';
  for (const word of words) {
    const candidate = out ? `${out} ${word}` : word;
    if (roughTokenEstimate(candidate) > maxTokens) break;
    out = candidate;
  }
  return out;
}
