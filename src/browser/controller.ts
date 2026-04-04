import { mkdir } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { BrowserController, BrowserTab } from '../types.ts';

export interface BrowserControllerOptions {
  port?: number;
  chromeBinary?: string;
  userDataDir?: string;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isMac(): boolean {
  return process.platform === 'darwin';
}

function isWindows(): boolean {
  return process.platform === 'win32';
}

function defaultUserDataDir(): string {
  return path.join(tmpdir(), 'ryft-browser-profile');
}

function quoteUrl(url: string): string {
  return encodeURIComponent(url);
}

async function findReachablePort(port: number, attempts = 20): Promise<number> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return port;
    } catch {
      // wait and retry
    }
    await delay(150);
  }
  throw new Error(`Chrome remote debugging port ${port} did not become ready`);
}

async function tryGetJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function spawnDetached(command: string, args: string[]): ChildProcess {
  const child = spawn(command, args, {
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  return child;
}

function openSystemBrowser(url: string): void {
  if (isMac()) {
    spawnDetached('open', [url]);
    return;
  }

  if (process.platform === 'linux') {
    spawnDetached('xdg-open', [url]);
    return;
  }

  if (isWindows()) {
    spawnDetached('cmd', ['/c', 'start', '', url]);
    return;
  }

  spawnDetached('open', [url]);
}

export function buildDevToolsUrl(port: number, tabId: string): string {
  return `devtools://devtools/bundled/inspector.html?ws=127.0.0.1:${port}/devtools/page/${tabId}`;
}

export async function createBrowserController(
  options: BrowserControllerOptions = {},
): Promise<BrowserController> {
  const port = options.port ?? 9222;
  const userDataDir = options.userDataDir ?? defaultUserDataDir();
  const chromeBinary =
    options.chromeBinary ??
    (isMac()
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : process.env.CHROME_BIN ?? 'google-chrome');

  let chromeProcess: ChildProcess | null = null;
  let started = false;
  let readyPort = port;

  async function ensureRunning(): Promise<void> {
    if (started) return;
    await mkdir(userDataDir, { recursive: true });

    if (isMac() || process.platform === 'linux' || isWindows()) {
      chromeProcess = spawnDetached(chromeBinary, [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        '--new-window',
        'about:blank',
      ]);
    } else {
      openSystemBrowser('about:blank');
    }

    readyPort = await findReachablePort(port);
    started = true;
  }

  async function listTabs(): Promise<BrowserTab[]> {
    await ensureRunning();
    const tabs = await tryGetJson<BrowserTab[]>(
      `http://127.0.0.1:${readyPort}/json/list`,
    );
    return tabs ?? [];
  }

  async function openUrl(url: string): Promise<BrowserTab | null> {
    await ensureRunning();
    const response = await fetch(
      `http://127.0.0.1:${readyPort}/json/new?${quoteUrl(url)}`,
    );
    if (!response.ok) {
      openSystemBrowser(url);
      return null;
    }
    return (await response.json()) as BrowserTab;
  }

  async function openDevTools(tabId?: string): Promise<void> {
    await ensureRunning();
    const tabs = await listTabs();
    const tab = tabId
      ? tabs.find(item => item.id === tabId)
      : tabs.find(item => item.type === 'page') ?? tabs[0];
    if (!tab) {
      throw new Error('No browser tab is available to inspect.');
    }
    openSystemBrowser(buildDevToolsUrl(readyPort, tab.id));
  }

  return {
    name: 'browser-surff',
    description:
      'Chrome and DevTools automation through a local remote-debugging browser session.',
    isReady: async () => started,
    openUrl,
    listTabs,
    openDevTools,
    close: async () => {
      if (chromeProcess && !chromeProcess.killed) {
        chromeProcess.kill('SIGTERM');
      }
      chromeProcess = null;
      started = false;
    },
  };
}
