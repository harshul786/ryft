#!/usr/bin/env node
import chalk from 'chalk';
import { Command } from 'commander';
import readline from 'node:readline/promises';
import { homedir } from 'node:os';
import { stdin as input, stdout as output } from 'node:process';
import { compactSession } from './commands/compact.ts';
import { initBrowser } from './browser/init_browser.ts';
import { formatBrowserTabs } from './browser/common.ts';
import { recordMemoryTurn } from './memory/store.ts';
import {
  defaultModelOption,
  formatModelPicker,
  resolveModelOption,
} from './models/catalog.ts';
import { resolveModes } from './modes/catalog.ts';
import { promptWithSession } from './runtime/promptBuilder.ts';
import { createSession } from './runtime/session.ts';
import { openProxyServer } from './runtime/proxyServer.ts';
import { streamChatCompletion } from './runtime/openaiClient.ts';
import { renderBanner, renderStatusLine } from './ui/chalkDraw.ts';

const program = new Command();

program
  .name('ryft')
  .description('Lean OpenAI-native ai-code CLI')
  .option('--mode <modes...>', 'select one or more modes')
  .option('--memory <mode>', 'select a memory mode')
  .option('--model <name>', 'select a model id, label, or provider-qualified name')
  .option('--proxy <url>', 'use a local OpenAI-compatible proxy URL')
  .option('--base-url <url>', 'override the upstream OpenAI-compatible base URL')
  .option('--api-key <key>', 'override the upstream API key')
  .option('--browser', 'initialize browser automation support')
  .option('--serve-proxy', 'run only the local proxy server')
  .option('--prompt <text>', 'send a single prompt and exit');

program.parse();

async function main(): Promise<void> {
  const opts = program.opts<{
    mode?: string[];
    memory?: 'claude-like' | 'hierarchy' | 'session';
    model?: string;
    proxy?: string;
    baseUrl?: string;
    apiKey?: string;
    browser?: boolean;
    serveProxy?: boolean;
    prompt?: string;
  }>();

  if (opts.serveProxy) {
    const server = await openProxyServer();
    console.log(chalk.green(`Ryft proxy listening on ${server.url}`));
    process.stdin.resume();
    return;
  }

  const session = createSession({
    modes: resolveModes(opts.mode ?? ['coder']),
    memoryMode: opts.memory ?? 'claude-like',
    model: resolveModelOption(opts.model) ?? defaultModelOption(),
    cwd: process.cwd(),
    homeDir: homedir(),
    proxyUrl: opts.proxy ?? process.env.RYFT_PROXY_URL ?? null,
    baseUrl: opts.baseUrl ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    apiKey: opts.apiKey ?? process.env.OPENAI_API_KEY ?? '',
  });

  if (opts.browser) {
    await initBrowser(session);
  }

    if (opts.prompt) {
    const prompt = await promptWithSession(session, opts.prompt);
    const response = await streamChatCompletion({
      baseUrl: session.config.baseUrl,
      apiKey: session.config.apiKey,
      model: session.config.model.id,
      messages: prompt,
      signal: session.abortController.signal,
      onDelta: chunk => process.stdout.write(chunk),
    });
    if (response.text) {
      session.appendAssistant(response.text);
      session.setMemoryState(
        await recordMemoryTurn(
          session.memoryMode.name,
          { cwd: session.config.cwd, homeDir: session.config.homeDir, sessionSnapshot: session.memoryState.snapshot },
          opts.prompt,
          response.text,
        ),
      );
    }
    if (response.usage) {
      process.stdout.write(`\n${renderStatusLine(session, response.usage)}`);
    }
    process.stdout.write('\n');
    return;
  }

  console.log(renderBanner(session));

  const rl = readline.createInterface({ input, output });

  while (true) {
    const line = await rl.question(chalk.cyan('ryft> '));
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed === '/exit' || trimmed === '/quit') break;

    if (trimmed.startsWith('/mode')) {
      session.setModes(resolveModes(trimmed.split(/\s+/).slice(1)));
      console.log(renderStatusLine(session));
      continue;
    }

    if (trimmed.startsWith('/memory')) {
      session.setMemoryMode((trimmed.split(/\s+/)[1] ?? 'claude-like') as 'claude-like' | 'hierarchy' | 'session');
      console.log(renderStatusLine(session));
      continue;
    }

    if (trimmed.startsWith('/model')) {
      const raw = trimmed.split(/\s+/).slice(1).join(' ').trim();
      if (!raw) {
        console.log(formatModelPicker(session.config.model.id));
        const answer = await rl.question(chalk.cyan('model> '));
        const selected = answer.trim()
          ? resolveModelOption(answer)
          : session.config.model;
        if (selected) {
          session.setModel(selected);
        } else if (answer.trim()) {
          console.log(chalk.yellow(`Unknown model: ${answer.trim()}`));
        }
      } else {
        const selected = resolveModelOption(raw);
        if (selected) {
          session.setModel(selected);
        } else {
          console.log(chalk.yellow(`Unknown model: ${raw}`));
        }
      }
      console.log(renderStatusLine(session));
      continue;
    }

    if (trimmed === '/compact') {
      await compactSession(session);
      console.log(chalk.yellow('Conversation compacted.'));
      continue;
    }

    if (trimmed === '/skills') {
      console.log(await session.describeSkills());
      continue;
    }

    if (trimmed === '/mcp') {
      console.log(session.describeMcp());
      continue;
    }

    if (trimmed === '/browser') {
      await initBrowser(session);
      continue;
    }

    if (trimmed.startsWith('/browser ')) {
      if (!session.browser) {
        await initBrowser(session);
      }
      const browser = session.browser;
      if (!browser) {
        console.log(chalk.red('Browser controller is unavailable.'));
        continue;
      }

      const [, subcommand, ...rest] = trimmed.split(/\s+/);
      if (subcommand === 'open') {
        const url = rest.join(' ').trim();
        if (!url) {
          console.log(chalk.yellow('Usage: /browser open <url>'));
          continue;
        }
        const tab = await browser.openUrl(url);
        console.log(tab ? `Opened ${tab.url}` : `Opened ${url}`);
        continue;
      }

      if (subcommand === 'tabs') {
        const tabs = await browser.listTabs();
        console.log(formatBrowserTabs(tabs));
        continue;
      }

      if (subcommand === 'devtools') {
        const tabId = rest[0];
        await browser.openDevTools(tabId);
        console.log(chalk.green('DevTools opened.'));
        continue;
      }

      if (subcommand === 'close') {
        await browser.close();
        session.setBrowser(null);
        console.log(chalk.green('Browser controller closed.'));
        continue;
      }

      console.log(chalk.yellow('Usage: /browser [open <url> | tabs | devtools [tab-id] | close]'));
      continue;
    }

    const prompt = await promptWithSession(session, trimmed);
    process.stdout.write(chalk.dim('thinking...\n'));
    try {
      session.appendUser(trimmed);
      const response = await streamChatCompletion({
        baseUrl: session.config.baseUrl,
        apiKey: session.config.apiKey,
        model: session.config.model.id,
        messages: prompt,
        signal: session.abortController.signal,
        onDelta: chunk => process.stdout.write(chunk),
      });
      if (response.text) {
        session.appendAssistant(response.text);
        session.setMemoryState(
          await recordMemoryTurn(
            session.memoryMode.name,
            { cwd: session.config.cwd, homeDir: session.config.homeDir, sessionSnapshot: session.memoryState.snapshot },
            trimmed,
            response.text,
          ),
        );
      }
      process.stdout.write('\n');
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    }
  }

  rl.close();
}

await main();
