export function createAbortController(): AbortController {
  return new AbortController();
}

export function roughTokenEstimate(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
