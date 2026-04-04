import type { BrowserController } from '../types.ts';

export function getBrowserMcpServerDescription(controller: BrowserController | null): string {
  if (!controller) {
    return 'Browser session tab context and DevTools MCP-style actions are available when browser-surff mode is active.';
  }

  return [
    controller.description,
    'Start with tab context, then use open_url, list_tabs, or open_devtools as needed.',
  ].join(' ');
}
