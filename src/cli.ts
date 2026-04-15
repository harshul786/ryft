#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";
import React from "react";
import { render } from "./ink.ts";
import { homedir } from "node:os";
import type { ModelOption } from "./types.ts";
import { initBrowser } from "./browser/init_browser.ts";
import { recordMemoryTurn } from "./memory/store.ts";
import {
  defaultModelOption,
  resolveModelOption,
  initializeModelFromConfig,
} from "./models/catalog.ts";
import { resolveModes } from "./modes/catalog.ts";
import { promptWithSession } from "./runtime/promptBuilder.ts";
import { createSession } from "./runtime/session.ts";
import { openProxyServer } from "./runtime/proxyServer.ts";
import { streamChatCompletion } from "./runtime/llmClient.ts";
import { renderBanner, renderStatusLine } from "./ui/chalkDraw.ts";
import {
  loadConfig,
  applyCliOverrides,
  loadGlobalConfig,
} from "./config/config-loader.ts";
import { saveConfig } from "./config/config-writer.ts";
import { runOnboarding } from "./onboarding/onboardingFlow.ts";
import { Root } from "./components/Root.tsx";
import { setupErrorHandlers, cliError } from "./cli/exit.ts";
import { handleLogsCommand } from "./commands/logs.ts";
import { logger, getFeatureLogger } from "./logging/index.ts";
import {
  type SkillSourcesConfig,
  DEFAULT_SKILL_SOURCES,
  discoverProjectSkillDirs,
} from "./config/skillSources.ts";
import { initializeSkillWatcher } from "./skills/loader.ts";

// Setup centralized error handling
setupErrorHandlers();

const DEBUG = process.env.DEBUG_SKILLS === "true";

const program = new Command();

program
  .name("ryft")
  .description("Lean OpenAI-native ai-code CLI")
  .option("--mode <modes...>", "select one or more modes")
  .option("--memory <mode>", "select a memory mode")
  .option(
    "--model <name>",
    "select a model id, label, or provider-qualified name",
  )
  .option("--proxy <url>", "use a local OpenAI-compatible proxy URL")
  .option(
    "--base-url <url>",
    "override the upstream OpenAI-compatible base URL",
  )
  .option("--api-key <key>", "override the upstream API key")
  .option("--browser", "initialize browser automation support")
  .option("--serve-proxy", "run only the local proxy server")
  .option("--prompt <text>", "send a single prompt and exit")
  .option("--add-dir <paths...>", "add additional skill directories");

program
  .command("logs [subcommand...]")
  .description("Manage Ryft logs")
  .action(async (args: string[]) => {
    try {
      await handleLogsCommand(args);
      process.exit(0);
    } catch (error) {
      console.error(chalk.red("Error executing logs command:"), error);
      process.exit(1);
    }
  });

// Root action — triggered for interactive REPL and all root-level flags
// (e.g. --prompt, --model, --browser).  Subcommands (e.g. `logs`) have their
// own .action() handlers that call process.exit() before reaching here.
program.action(async () => {
  try {
    await main();
  } catch (err) {
    console.error(chalk.red("Error:"), err);
    process.exit(1);
  }
});

program.parse();

async function main(): Promise<void> {
  const opts = program.opts<{
    mode?: string[];
    memory?: "claude-like" | "hierarchy" | "session";
    model?: string;
    proxy?: string;
    baseUrl?: string;
    apiKey?: string;
    browser?: boolean;
    serveProxy?: boolean;
    prompt?: string;
    addDir?: string[];
  }>();

  // Initialize logger based on environment
  if (process.env.RYFT_LOG_LEVEL) {
    const level = process.env.RYFT_LOG_LEVEL as
      | "debug"
      | "info"
      | "warn"
      | "error";
    logger.setLevel(level);
  }

  const logFeature = getFeatureLogger("CLI");
  logFeature.info("Ryft CLI started", { version: "0.1.0" });

  if (opts.serveProxy) {
    const server = await openProxyServer();
    console.log(chalk.green(`Ryft proxy listening on ${server.url}`));
    process.stdin.resume();
    return;
  }

  // Run onboarding if this is first time setup
  const onboardingConfig = await runOnboarding();
  if (onboardingConfig && (onboardingConfig.apiKey || onboardingConfig.model)) {
    // Save onboarding results to config file
    await saveConfig(onboardingConfig, { target: "global", backup: true });
  }

  // Load config with precedence: defaults < global config < workspace config < CLI flags
  let config = loadConfig();
  config = applyCliOverrides(config, opts);

  // Resolve modes from config or CLI
  const modes = opts.mode ?? config.defaultModes ?? ["coder"];

  // Resolve model from config or CLI with config-aware initialization
  const modelStr = opts.model ?? config.model;
  const model = initializeModelFromConfig(modelStr);

  // Resolve memory mode from config or CLI
  const memoryMode = opts.memory ?? config.defaultMemoryMode ?? "claude-like";

  // Initialize skill sources with multi-source discovery
  const skillSources: SkillSourcesConfig = {
    ...DEFAULT_SKILL_SOURCES,
    project: discoverProjectSkillDirs(process.cwd()),
    additional: opts.addDir ?? [],
  };

  if (process.env.DEBUG_SKILLS === "true") {
    console.debug("[CLI] Skill sources initialized:", skillSources);
  }

  // Capture the actual working directory from environment or process
  // PWD env var is more reliable than process.cwd() in some contexts
  const actualCwd = process.env.PWD || process.cwd();

  const session = createSession({
    modes: resolveModes(modes),
    memoryMode: memoryMode as "claude-like" | "hierarchy" | "session",
    model,
    cwd: actualCwd,
    homeDir: homedir(),
    proxyUrl:
      opts.proxy ?? config.proxyUrl ?? process.env.RYFT_PROXY_URL ?? null,
    baseUrl:
      opts.baseUrl ??
      config.baseUrl ??
      process.env.OPENAI_BASE_URL ??
      "https://api.openai.com/v1",
    apiKey: opts.apiKey ?? config.apiKey ?? process.env.OPENAI_API_KEY ?? "",
    anthropicApiKey:
      config.anthropicApiKey || process.env.ANTHROPIC_API_KEY || "",
    geminiApiKey:
      config.geminiApiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      "",
    ollamaBaseUrl:
      config.ollamaBaseUrl ||
      process.env.OLLAMA_BASE_URL ||
      "http://localhost:11434",
  });

  // Reload global config into session to ensure absolutely latest values
  const freshGlobalConfig = loadGlobalConfig();
  if (freshGlobalConfig.apiKey) {
    session.config.apiKey = freshGlobalConfig.apiKey;
  }
  if (freshGlobalConfig.anthropicApiKey) {
    session.config.anthropicApiKey = freshGlobalConfig.anthropicApiKey;
  }
  if (freshGlobalConfig.geminiApiKey) {
    session.config.geminiApiKey = freshGlobalConfig.geminiApiKey;
  }
  if (freshGlobalConfig.ollamaBaseUrl) {
    session.config.ollamaBaseUrl = freshGlobalConfig.ollamaBaseUrl;
  }
  if (freshGlobalConfig.baseUrl) {
    session.config.baseUrl = freshGlobalConfig.baseUrl;
  }
  if (freshGlobalConfig.proxyUrl !== undefined) {
    session.config.proxyUrl = freshGlobalConfig.proxyUrl;
  }
  if (freshGlobalConfig.model) {
    // Update model if available in fresh config
    const freshModel = initializeModelFromConfig(
      String(freshGlobalConfig.model),
    );
    if (freshModel) {
      session.config.model = freshModel;
    }
  }

  if (opts.browser) {
    await initBrowser(session);
  }

  // Initialize MCP servers to register tools (needed for tool execution)
  await session.initializeMcpServers();

  // Initialize skill watcher for hot reload
  let skillWatcher = null;
  try {
    skillWatcher = await initializeSkillWatcher(skillSources);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[CLI] Failed to initialize skill watcher: ${reason}`);
  }

  if (opts.prompt) {
    const prompt = await promptWithSession(session, opts.prompt);
    const response = await streamChatCompletion({
      baseUrl: session.config.baseUrl,
      apiKey: session.config.apiKey,
      anthropicApiKey: session.config.anthropicApiKey,
      geminiApiKey: session.config.geminiApiKey,
      ollamaBaseUrl: session.config.ollamaBaseUrl,
      providerType: session.config.model.providerType,
      model: session.config.model.id,
      messages: prompt,
      signal: session.abortController.signal,
      onDelta: (chunk) => process.stdout.write(chunk),
    });
    if (response.text || response.toolCalls.length > 0) {
      // Persist first assistant turn (may include tool calls)
      session.appendAssistantWithTools(response.text, response.toolCalls);

      // ── Multi-turn tool-call loop (non-interactive / --prompt mode) ──────
      const MAX_TOOL_TURNS = 15;
      let turnResult = response;

      for (
        let turn = 0;
        turn < MAX_TOOL_TURNS && turnResult.toolCalls.length > 0;
        turn++
      ) {
        const toolNames = turnResult.toolCalls.map((t) => t.name).join(", ");
        process.stdout.write(`\n⚙️  Running: ${toolNames}…\n`);

        const toolResults = await session.toolDispatcher.dispatchToolCalls(
          turnResult.toolCalls,
        );

        session.appendToolResults(toolResults);

        let followUpText = "";
        turnResult = await streamChatCompletion({
          baseUrl: session.config.baseUrl,
          apiKey: session.config.apiKey,
          anthropicApiKey: session.config.anthropicApiKey,
          geminiApiKey: session.config.geminiApiKey,
          ollamaBaseUrl: session.config.ollamaBaseUrl,
          providerType: session.config.model.providerType,
          model: session.config.model.id,
          messages: session.history,
          signal: session.abortController.signal,
          onDelta: (chunk) => {
            followUpText += chunk;
            process.stdout.write(chunk);
          },
        });

        session.appendAssistantWithTools(followUpText, turnResult.toolCalls);
      }

      session.setMemoryState(
        await recordMemoryTurn(
          session.memoryMode.name,
          {
            cwd: session.config.cwd,
            homeDir: session.config.homeDir,
            sessionSnapshot: session.memoryState.snapshot,
          },
          opts.prompt,
          response.text || "",
        ),
      );
    }
    if (response.usage) {
      process.stdout.write(`\n${renderStatusLine(session, response.usage)}`);
    }
    process.stdout.write("\n");
    return;
  }

  console.log(renderBanner(session));

  // Mount React + Ink REPL with proper stdin/stdout configuration
  // (Works with both TTY and piped input for flexibility)
  const { unmount } = await render(React.createElement(Root, { session }), {
    stdin: process.stdin,
    stdout: process.stdout,
  });

  // Handle graceful exit
  process.on("SIGINT", async () => {
    unmount();
    // Clean up skill watcher to prevent memory leaks
    if (skillWatcher) {
      try {
        await skillWatcher.close();
        DEBUG && console.debug("[CLI] Skill watcher closed");
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        DEBUG && console.debug(`[CLI] Error closing watcher: ${reason}`);
      }
    }
    process.exit(0);
  });
}
