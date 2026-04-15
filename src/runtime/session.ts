import type {
  BrowserController,
  ChatMessage,
  MemoryMode,
  MessageContentPart,
  Mode,
  SessionConfig,
  MemoryState,
  ToolUseContentPart,
  ToolResultContentPart,
} from "../types.ts";
import { buildSystemPrompt } from "./promptBuilder.ts";
import { defaultMemoryMode, resolveMemoryMode } from "../memory/catalog.ts";
import { getModeSkills } from "../modes/skill-merger.ts";
import { createAbortController } from "./util.ts";
import { getBrowserMcpServerDescription } from "../browser/mcp.ts";
import type { TokenBudgetTracker } from "../tokens/budget.ts";
import { getGlobalTokenBudget } from "../tokens/budget.ts";
import { getFeatureLogger } from "../logging/index.ts";
import { McpClientPool } from "../mcp/client.ts";
import type { McpServerConfig } from "../mcp/protocol.ts";
import { ToolRegistry } from "../mcp/tool-registry.ts";
import { ToolDispatcher } from "../mcp/tool-dispatcher.ts";
import { BrowserLifecycleManager } from "../browser/lifecycle.ts";
import { getModePacks } from "../modes/pack-loader.ts";
import { McpServerRegistry } from "../mcp/registry.ts";
import { initializeCoderMode, clearCoderState } from "./coderInit.ts";
import { registerBuiltinTools } from "../mcp/builtin-tools.ts";

export interface Session {
  config: SessionConfig;
  history: ChatMessage[];
  modes: Mode[];
  memoryMode: MemoryMode;
  browser: BrowserController | null;
  memoryState: MemoryState;
  abortController: AbortController;
  // Token tracking
  tokenBudget: TokenBudgetTracker;
  // MCP infrastructure
  mcpClients: InstanceType<typeof McpClientPool>;
  toolRegistry: InstanceType<typeof ToolRegistry>;
  toolDispatcher: InstanceType<typeof ToolDispatcher>;
  browserLifecycle: InstanceType<typeof BrowserLifecycleManager>;
  // Session methods
  setModes(nextModes: Mode[]): Promise<void>;
  setMemoryMode(name: MemoryMode["name"]): void;
  setModel(model: SessionConfig["model"]): void;
  setBrowser(controller: BrowserController | null): void;
  setMemoryState(snapshot: string): void;
  appendUser(text: string): void;
  appendAssistant(text: string): void;
  /**
   * Append an assistant turn that includes one or more tool calls.
   * When `toolCalls` is non-empty the message content is stored as a
   * structured array so the model can reference it in the next turn.
   */
  appendAssistantWithTools(text: string, toolCalls: ToolUseContentPart[]): void;
  /**
   * Append the results of tool executions as individual `role: "tool"` messages.
   * Each result is a separate message with `tool_call_id` set so the model can
   * match it against its earlier tool-call block.
   */
  appendToolResults(results: ToolResultContentPart[]): void;
  describeSkills(): Promise<string>;
  describeMcp(): string;
  describeBrowser(): string;
  initializeMcpServers(): Promise<void>;
}

export function createSession(config: SessionConfig): Session {
  const history: ChatMessage[] = [];
  let activeModes = config.modes;
  let memoryMode = resolveMemoryMode(
    config.memoryMode ?? defaultMemoryMode().name,
  );

  // Initialize MCP infrastructure
  const mcpClients = new McpClientPool();
  const toolRegistry = new ToolRegistry();
  const browserLifecycle = new BrowserLifecycleManager();
  const toolDispatcher = new ToolDispatcher(
    toolRegistry,
    mcpClients,
    browserLifecycle,
  );

  // Register built-in tools (file reading, etc.) that are always available
  registerBuiltinTools(toolRegistry);

  // Initialize token budget (default 4096 tokens for session)
  const tokenBudget = getGlobalTokenBudget(4096);

  const session: Session = {
    config: {
      ...config,
      baseUrl: config.proxyUrl || config.baseUrl,
      cwd: config.cwd ?? process.cwd(),
      homeDir: config.homeDir,
    },
    history,
    browser: null,
    memoryState: { snapshot: "" },
    tokenBudget,
    mcpClients,
    toolRegistry,
    toolDispatcher,
    browserLifecycle,
    get modes() {
      return activeModes;
    },
    get memoryMode() {
      return memoryMode;
    },
    abortController: createAbortController(),
    setModes(nextModes: Mode[]) {
      activeModes = nextModes;
      // Clear coder state if switching away from coder mode
      if (!nextModes.some((m) => m.name === "coder")) {
        clearCoderState();
      }
      // Re-spawn MCP servers for the new modes, then rebuild system prompt.
      const log = getFeatureLogger("MCP");
      return session.mcpClients
        .clear()
        .then(() => {
          session.toolRegistry.clear();
          return session.initializeMcpServers();
        })
        .then(() => buildSystemPrompt(session))
        .then((prompt) => {
          if (history.length > 0 && history[0]?.role === "system") {
            history[0] = { role: "system", content: prompt };
          }
        })
        .catch((err) => {
          log.warn("Failed to re-initialize MCP servers after mode switch", {
            error: String(err),
          });
        });
    },
    setMemoryMode(name: MemoryMode["name"]) {
      memoryMode = resolveMemoryMode(name);
    },
    setModel(model: SessionConfig["model"]) {
      session.config.model = model;
      // Sync the URL routing fields so streamChatCompletion uses the right endpoint.
      if (model?.baseUrl) {
        if (model.providerType === "ollama") {
          session.config.ollamaBaseUrl = model.baseUrl;
        } else if (
          model.providerType !== "anthropic" &&
          model.providerType !== "google"
        ) {
          session.config.baseUrl = model.baseUrl;
        }
      }
      // Rebuild system prompt in history[0] so the new model gets correct
      // tool-calling vs INVOKE_SKILL instructions — not the startup model's.
      buildSystemPrompt(session)
        .then((prompt) => {
          if (history.length > 0 && history[0]?.role === "system") {
            history[0] = { role: "system", content: prompt };
          }
        })
        .catch(() => {
          /* non-fatal */
        });
    },
    setBrowser(controller: BrowserController | null) {
      session.browser = controller;
    },
    setMemoryState(snapshot: string) {
      session.memoryState.snapshot = snapshot;
    },
    appendUser(text: string) {
      history.push({ role: "user", content: text });
    },
    appendAssistant(text: string) {
      history.push({ role: "assistant", content: text });
    },
    appendAssistantWithTools(text: string, toolCalls: ToolUseContentPart[]) {
      if (toolCalls.length === 0) {
        // Plain-text assistant turn — no need for structured content
        history.push({ role: "assistant", content: text });
        return;
      }
      const parts: MessageContentPart[] = [];
      if (text) parts.push({ type: "text", text });
      parts.push(...toolCalls);
      history.push({ role: "assistant", content: parts });
    },
    appendToolResults(results: ToolResultContentPart[]) {
      for (const result of results) {
        history.push({
          role: "tool",
          content: result.content,
          tool_call_id: result.tool_use_id,
        });
        // When the tool returned image data (e.g. a screenshot), inject it as
        // a vision-capable user message so the model can actually "see" it.
        // A plain ToolMessage with embedded base64 JSON is not understood by
        // vision models and causes requests to time out or fail.
        if (result.imageData) {
          history.push({
            role: "user",
            content: [
              { type: "text", text: "Here is the screenshot from the tool:" },
              { type: "image_url", image_url: { url: result.imageData } },
            ] as unknown as import("../types.ts").MessageContentPart[],
          });
        }
      }
    },
    async describeSkills() {
      // Load skills for each active mode and merge them
      try {
        const skillPromises = activeModes.map((mode) => getModeSkills(mode));
        const skillArrays = await Promise.all(skillPromises);

        // Deduplicate and merge skills from all modes
        const skillMap = new Map<string, (typeof skillArrays)[0][0]>();
        for (const modeSkills of skillArrays) {
          for (const skill of modeSkills) {
            if (!skillMap.has(skill.name)) {
              skillMap.set(skill.name, skill);
            }
          }
        }

        const allSkills = Array.from(skillMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        );

        return (
          allSkills
            .map((skill) => `- ${skill.name}: ${skill.description}`)
            .join("\n") || "No skills loaded."
        );
      } catch (error) {
        const log = getFeatureLogger("Skills");
        log.warn("Failed to load skills");
        return "No skills loaded.";
      }
    },
    describeMcp() {
      const modeServers = activeModes
        .flatMap((mode) => mode.mcpServers)
        .map((server) => `- ${server.name}: ${server.description}`)
        .join("\n");
      const browserServer = session.browser
        ? `- browser-surff: ${getBrowserMcpServerDescription(session.browser)}`
        : "";
      return (
        [modeServers, browserServer].filter(Boolean).join("\n") ||
        "No MCP servers configured."
      );
    },
    describeBrowser() {
      if (!session.browser) {
        return "Browser automation is not initialized yet.";
      }
      return [
        `Browser controller: ${session.browser.name}`,
        session.browser.description,
        "Commands: /browser open <url>, /browser tabs, /browser devtools [tab-id], /browser close",
      ].join("\n");
    },
    async initializeMcpServers() {
      const log = getFeatureLogger("MCP");
      try {
        // Get packs for active modes (this loads pack.json with full command/args)
        log.info(`Active modes: ${activeModes.map((m) => m.name).join(", ")}`);
        log.debug(`Looking for packs with process.cwd()=${process.cwd()}`);
        const allPacks = getModePacks(
          activeModes.map((m) => m.name),
          process.cwd(),
        );
        log.info(
          `Found ${allPacks.length} pack(s): ${allPacks.map((p) => p.name).join(", ")}`,
        );

        if (allPacks.length === 0) {
          log.debug("No mode packs found, skipping server initialization");
          return;
        }

        // Load server configs from packs
        const registry = new McpServerRegistry();
        registry.registerFromPacks(allPacks);
        let serverConfigs = registry.getAllServers();

        // Filter to only servers with command/args (skip references)
        serverConfigs = serverConfigs.filter(
          (config) =>
            config.command && config.args && Array.isArray(config.args),
        );

        log.info(`Found ${serverConfigs.length} fully-configured server(s)`);

        if (serverConfigs.length === 0) {
          log.debug("No fully-configured MCP servers to spawn");
          return;
        }

        log.info(
          `Loading ${serverConfigs.length} server(s): ${serverConfigs.map((c) => c.id).join(", ")}`,
        );

        // Set active modes env var so child processes (e.g. skills-server) can filter accordingly
        process.env.RYFT_ACTIVE_MODES = activeModes
          .map((m) => m.name)
          .join(",");

        // Initialize coder mode if active
        if (activeModes.some((m) => m.name === "coder")) {
          const coderEnv = initializeCoderMode(session.config);
          Object.assign(process.env, coderEnv);
        }

        // Spawn all configured servers
        const spawnedServers =
          await session.mcpClients.spawnServers(serverConfigs);
        log.info(`Spawned ${spawnedServers.size} server(s) successfully`);

        // Discover and register tools from each spawned server
        for (const [serverId, client] of spawnedServers) {
          try {
            log.debug(`Attempting to get tools list from ${serverId}...`);
            // Add timeout to prevent hanging
            const toolsPromise = client.listTools();
            const timeoutPromise = new Promise((resolve, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(
                      `Timeout waiting for tools list from ${serverId}`,
                    ),
                  ),
                5000,
              ),
            );
            const tools = await Promise.race([
              toolsPromise,
              timeoutPromise as Promise<any>,
            ]);
            log.info(
              `Discovered ${tools.length} tool(s) from server ${serverId}`,
            );

            if (tools.length > 0) {
              // Compress and register tools
              const { compressToolSchemas } =
                await import("../mcp/schema-compressor.ts");
              const compressed = compressToolSchemas(tools);

              const toolsToAdd = tools.map((full: any, index: number) => ({
                full,
                compressed: compressed[index],
              }));

              const serverConfig = serverConfigs.find((c) => c.id === serverId);
              if (serverConfig) {
                log.debug(
                  `Registering ${toolsToAdd.length} tool(s) from ${serverId}`,
                );
                session.toolRegistry.addTools(
                  serverId,
                  serverConfig.name,
                  toolsToAdd,
                );
                log.info(
                  `Registered ${toolsToAdd.length} tool(s) from ${serverId}`,
                );
              }
            }
          } catch (error) {
            log.warn("Failed to discover tools", {
              serverId,
              error: String(error),
            });
          }
        }
      } catch (error) {
        log.error(
          "Failed to initialize servers",
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    },
  };

  return session;
}
