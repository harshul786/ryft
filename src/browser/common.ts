import type { BrowserTab } from '../types.ts';

export function formatBrowserTabs(tabs: BrowserTab[]): string {
  if (tabs.length === 0) {
    return 'No browser tabs found.';
  }

  return tabs
    .map((tab, index) => {
      const title = tab.title?.trim() || '(untitled)';
      const url = tab.url?.trim() || '(no url)';
      return `${index + 1}. ${title}\n   ${url}\n   id=${tab.id}`;
    })
    .join('\n');
}
