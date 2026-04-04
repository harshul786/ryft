import type {
  BrowserController,
  ChatMessage,
  MemoryMode,
  Mode,
  SessionConfig,
  MemoryState,
} from '../types.ts';
import { defaultMemoryMode, resolveMemoryMode } from '../memory/catalog.ts';
import { loadSkillsForModes } from '../skills/loader.ts';
import { createAbortController } from './util.ts';
import { getBrowserMcpServerDescription } from '../browser/mcp.ts';

export interface Session {
  config: SessionConfig;
  history: ChatMessage[];
  modes: Mode[];
  memoryMode: MemoryMode;
  browser: BrowserController | null;
  memoryState: MemoryState;
  abortController: AbortController;
  setModes(nextModes: Mode[]): void;
  setMemoryMode(name: MemoryMode['name']): void;
  setModel(model: SessionConfig['model']): void;
  setBrowser(controller: BrowserController | null): void;
  setMemoryState(snapshot: string): void;
  appendUser(text: string): void;
  appendAssistant(text: string): void;
  describeSkills(): Promise<string>;
  describeMcp(): string;
  describeBrowser(): string;
}

export function createSession(config: SessionConfig): Session {
  const history: ChatMessage[] = [];
  let activeModes = config.modes;
  let memoryMode = resolveMemoryMode(config.memoryMode ?? defaultMemoryMode().name);

  const session: Session = {
    config: {
      ...config,
      baseUrl: config.proxyUrl ?? config.baseUrl,
      cwd: config.cwd ?? process.cwd(),
      homeDir: config.homeDir,
    },
    history,
    browser: null,
    memoryState: { snapshot: '' },
    get modes() {
      return activeModes;
    },
    get memoryMode() {
      return memoryMode;
    },
    abortController: createAbortController(),
    setModes(nextModes: Mode[]) {
      activeModes = nextModes;
    },
    setMemoryMode(name: MemoryMode['name']) {
      memoryMode = resolveMemoryMode(name);
    },
    setModel(model: SessionConfig['model']) {
      session.config.model = model;
    },
    setBrowser(controller: BrowserController | null) {
      session.browser = controller;
    },
    setMemoryState(snapshot: string) {
      session.memoryState.snapshot = snapshot;
    },
    appendUser(text: string) {
      history.push({ role: 'user', content: text });
    },
    appendAssistant(text: string) {
      history.push({ role: 'assistant', content: text });
    },
    async describeSkills() {
      const skills = await loadSkillsForModes(activeModes);
      return skills.map(skill => `- ${skill.name}: ${skill.description}`).join('\n') || 'No skills loaded.';
    },
    describeMcp() {
      const modeServers = activeModes
        .flatMap(mode => mode.mcpServers)
        .map(server => `- ${server.name}: ${server.description}`)
        .join('\n');
      const browserServer = session.browser
        ? `- browser-surff: ${getBrowserMcpServerDescription(session.browser)}`
        : '';
      return [modeServers, browserServer].filter(Boolean).join('\n') || 'No MCP servers configured.';
    },
    describeBrowser() {
      if (!session.browser) {
        return 'Browser automation is not initialized yet.';
      }
      return [
        `Browser controller: ${session.browser.name}`,
        session.browser.description,
        'Commands: /browser open <url>, /browser tabs, /browser devtools [tab-id], /browser close',
      ].join('\n');
    },
  };

  return session;
}
