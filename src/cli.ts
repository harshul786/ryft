#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";
import React from "react";
import { render } from "ink";
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
import { streamChatCompletion } from "./runtime/openaiClient.ts";
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

// Setup centralized error handling
setupErrorHandlers();

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
  .option("--prompt <text>", "send a single prompt and exit");

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
  }>();

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

  const session = createSession({
    modes: resolveModes(modes),
    memoryMode: memoryMode as "claude-like" | "hierarchy" | "session",
    model,
    cwd: process.cwd(),
    homeDir: homedir(),
    proxyUrl:
      opts.proxy ?? config.proxyUrl ?? process.env.RYFT_PROXY_URL ?? null,
    baseUrl:
      opts.baseUrl ??
      config.baseUrl ??
      process.env.OPENAI_BASE_URL ??
      "https://api.openai.com/v1",
    apiKey: opts.apiKey ?? config.apiKey ?? process.env.OPENAI_API_KEY ?? "",
  });

  // Reload global config into session to ensure absolutely latest values
  const freshGlobalConfig = loadGlobalConfig();
  if (freshGlobalConfig.apiKey) {
    session.config.apiKey = freshGlobalConfig.apiKey;
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

  if (opts.prompt) {
    const prompt = await promptWithSession(session, opts.prompt);
    const response = await streamChatCompletion({
      baseUrl: session.config.baseUrl,
      apiKey: session.config.apiKey,
      model: session.config.model.id,
      messages: prompt,
      signal: session.abortController.signal,
      onDelta: (chunk) => process.stdout.write(chunk),
    });
    if (response.text) {
      session.appendAssistant(response.text);

      // Handle tool_use blocks (Phase 3E)
      const toolUses = session.toolDispatcher.extractToolUsesFromResponse(
        response.text,
      );

      if (toolUses.length > 0) {
        try {
          // Execute all tool calls
          const results =
            await session.toolDispatcher.dispatchToolCalls(toolUses);

          // Format tool results for conversation
          const resultsText =
            session.toolDispatcher.formatToolResultsForConversation(results);

          if (resultsText) {
            process.stdout.write(`\n\n**Tool Execution Results:**\n${resultsText}`);
            session.appendUser(resultsText);
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          process.stdout.write(
            `\n\n❌ Tool execution failed: ${errorMsg}`,
          );
        }
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
          response.text,
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

  // Check if stdin is a TTY (interactive terminal)
  if (!process.stdin.isTTY) {
    console.error(
      chalk.yellow(
        "Warning: Not running in an interactive terminal. Ryft REPL requires a TTY.",
      ),
    );
    console.error(chalk.yellow("Use --prompt to send a single message."));
    process.exit(1);
  }

  // Mount React + Ink REPL with proper stdin/stdout configuration
  const { unmount } = render(React.createElement(Root, { session }), {
    stdin: process.stdin,
    stdout: process.stdout,
  });

  // Handle graceful exit
  process.on("SIGINT", () => {
    unmount();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(chalk.red("Error:"), err);
  process.exit(1);
});
