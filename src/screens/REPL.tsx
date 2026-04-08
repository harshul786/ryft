/**
 * REPL Screen
 * Main interaction loop for the CLI
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Text,
  useInput,
  ScrollBox,
  type ScrollBoxHandle,
} from "../ink.ts";
import { useAppState, useSetAppState } from "../state/AppState.tsx";
import { findCommand, executeCommand } from "../commands.ts";
import { initializeCommands } from "../cli/handlers/index.ts";
import { filterCommands } from "../ui/commandSuggestions.ts";
import {
  canExecuteCommand,
  getCommandBlockReason,
} from "../cli/permissions.ts";
import { cliWarn } from "../cli/exit.ts";
import { Select } from "../ui/Select.tsx";
import { TextInput } from "../ui/TextInput.tsx";
import { buildSystemPrompt } from "../runtime/promptBuilder.ts";
import { streamChatCompletion } from "../runtime/llmClient.ts";
import { applyTokenCap } from "../runtime/tokenBudget.ts";
import { getModeSkills } from "../modes/skill-merger.ts";
import { invokeSkill } from "../tools/skill-tool.ts";
import {
  BROWSER_SURFF_PROMPT,
  BROWSER_SURFF_SKILL_HINT,
} from "../browser/prompt.ts";
import { COLORS, SPINNER_FRAMES, SPINNER_INTERVAL_MS } from "../ui/theme.ts";

// Initialize command system on import
initializeCommands();

export const REPL: React.FC = () => {
  const appState = useAppState();
  const setAppState = useSetAppState();
  const initializedRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<ScrollBoxHandle>(null);
  const stickyRef = useRef(true);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [termRows, setTermRows] = useState<number>(process.stdout.rows ?? 24);
  const [termCols, setTermCols] = useState<number>(
    process.stdout.columns ?? 80,
  );

  // Track terminal dimensions on resize
  useEffect(() => {
    const onResize = () => {
      setTermRows(process.stdout.rows ?? 24);
      setTermCols(process.stdout.columns ?? 80);
    };
    process.stdout.on("resize", onResize);
    return () => {
      process.stdout.off("resize", onResize);
    };
  }, []);

  // Animate spinner while responding
  useEffect(() => {
    if (!appState.isAssistantResponding) return;
    const id = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, SPINNER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [appState.isAssistantResponding]);

  useEffect(() => {
    // Initialize on first render only
    if (!initializedRef.current) {
      // Build and inject system prompt into session history at startup (once only)
      const initializeSession = async () => {
        // Note: MCP servers are already initialized in cli.ts before REPL mounts
        // Build system prompt using enhanced promptBuilder (includes tools, skills, modes)
        const systemPrompt = await buildSystemPrompt(appState.session);

        // Prepend system prompt to session history
        appState.session.history.unshift({
          role: "system",
          content: systemPrompt,
        });

        // Update state once system prompt is ready
        setAppState((prev) => ({
          ...prev,
          messages: [
            {
              role: "assistant",
              content: "Welcome to Ryft REPL. Type /help for commands.",
            },
          ],
          inputValue: "",
        }));
      };

      initializeSession();
      initializedRef.current = true;
    }
  }, [setAppState]);

  // Debounced suggestion generation
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (appState.inputValue.startsWith("/")) {
        // Use command suggestions with framework integration
        const matches = filterCommands(appState.inputValue);
        if (matches.length > 0) {
          const firstMatch = matches[0].command;
          setAppState((prev) => ({
            ...prev,
            promptSuggestion: {
              text: firstMatch,
              shownAt: Date.now(),
            },
          }));
        } else {
          setAppState((prev) => ({
            ...prev,
            promptSuggestion: {
              text: null,
              shownAt: 0,
            },
          }));
        }
      } else {
        setAppState((prev) => ({
          ...prev,
          promptSuggestion: {
            text: null,
            shownAt: 0,
          },
        }));
      }
    }, 100);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [appState.inputValue, setAppState]);

  // Auto-scroll to bottom when new messages arrive and user is at bottom (sticky)
  useEffect(() => {
    if (stickyRef.current) {
      scrollRef.current?.scrollToBottom();
    }
  }, [appState.messages.length]);

  // Handle keyboard input
  useInput(async (input, key) => {
    // If selector or text-input prompt is open, let it handle input
    if (appState.selector || appState.prompter) {
      return;
    }

    // Handle Ctrl+C or Ctrl+D to exit
    if ((key.ctrl && input === "c") || (key.ctrl && input === "d")) {
      process.exit(0);
    }

    // ── Scroll keybindings ──────────────────────────────────────
    if (key.upArrow) {
      stickyRef.current = false;
      scrollRef.current?.scrollBy(-3);
      return;
    }
    if (key.downArrow) {
      const handle = scrollRef.current;
      if (handle) {
        const atBottom =
          handle.getScrollTop() + handle.getViewportHeight() >=
          handle.getScrollHeight() - 1;
        if (atBottom) {
          stickyRef.current = true;
          handle.scrollToBottom();
        } else {
          handle.scrollBy(3);
        }
      }
      return;
    }
    if (key.pageUp) {
      stickyRef.current = false;
      scrollRef.current?.scrollBy(
        -(scrollRef.current?.getViewportHeight() ?? 10),
      );
      return;
    }
    if (key.pageDown) {
      const handle = scrollRef.current;
      if (handle) {
        const atBottom =
          handle.getScrollTop() + handle.getViewportHeight() >=
          handle.getScrollHeight() - 1;
        if (atBottom) {
          stickyRef.current = true;
          handle.scrollToBottom();
        } else {
          handle.scrollBy(handle.getViewportHeight());
        }
      }
      return;
    }

    // Handle Tab to accept suggestion
    if (key.tab) {
      if (appState.promptSuggestion.text) {
        setAppState((prev) => ({
          ...prev,
          inputValue: appState.promptSuggestion.text!,
          promptSuggestion: {
            text: null,
            shownAt: 0,
          },
        }));
      }
      return;
    }

    // Handle backspace and delete
    // Check multiple variations across different terminals
    // Backspace can be sent as:
    // - key.backspace or key.delete properties (Ink)
    // - Character \b (ASCII 8)
    // - Character \x7f (ASCII 127, DEL)
    // - Ctrl+H combo
    // - Some Mac terminals send raw character codes

    let isBackspace = key.backspace || key.delete;

    // Also check if input character is a backspace/delete code
    if (input && input.length === 1) {
      const code = input.charCodeAt(0);
      isBackspace = isBackspace || code === 8 || code === 127;
    }

    // Check string comparisons too
    isBackspace =
      isBackspace || input === "\b" || input === "\x08" || input === "\x7f";

    // Ctrl+H is also backspace
    isBackspace = isBackspace || (key.ctrl && input === "h");

    if (isBackspace) {
      setAppState((prev) => ({
        ...prev,
        inputValue: prev.inputValue.slice(0, -1),
      }));
      return;
    }

    // Handle enter
    if (key.return) {
      const input_val = appState.inputValue.trim();
      if (!input_val) return;

      // Add user message
      setAppState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "user",
            content: input_val,
          },
        ],
        inputValue: "",
        promptSuggestion: {
          text: null,
          shownAt: 0,
        },
      }));

      // Process command or message
      if (input_val.startsWith("/")) {
        const parts = input_val.slice(1).split(" ");
        const commandName = parts[0];
        const args = parts.slice(1);

        const command = findCommand(commandName);
        if (command) {
          // Check permissions before execution
          const context = {
            session: appState.session,
            appState,
            setAppState,
          };

          canExecuteCommand(commandName, context)
            .then(async (allowed) => {
              if (!allowed) {
                const reason = await getCommandBlockReason(
                  commandName,
                  context,
                );
                const message =
                  reason ||
                  `Command '${commandName}' is not allowed in current context`;
                setAppState((prev) => ({
                  ...prev,
                  messages: [
                    ...prev.messages,
                    {
                      role: "assistant",
                      content: `❌ Permission denied: ${message}`,
                    },
                  ],
                }));
                return;
              }

              // Execute with structured error handling
              try {
                await executeCommand(commandName, args, context);
              } catch (error) {
                const errorMsg =
                  error instanceof Error ? error.message : String(error);
                setAppState((prev) => ({
                  ...prev,
                  messages: [
                    ...prev.messages,
                    {
                      role: "assistant",
                      content: `❌ Error executing ${commandName}: ${errorMsg}`,
                    },
                  ],
                }));
                if (process.env.DEBUG) {
                  cliWarn(`Debug: Command '${commandName}' failed`, errorMsg);
                }
              }
            })
            .catch((error) => {
              setAppState((prev) => ({
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    role: "assistant",
                    content: `❌ Error checking permissions: ${error instanceof Error ? error.message : String(error)}`,
                  },
                ],
              }));
            });
        } else {
          // Check if this is a skill invocation
          try {
            const skillResult = await invokeSkill(
              commandName,
              appState.session.modes,
            );
            if (skillResult.success && skillResult.content) {
              setAppState((prev) => ({
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    role: "assistant",
                    content: `📚 Skill: ${commandName}\n\n${skillResult.content}`,
                  },
                ],
              }));
            } else {
              setAppState((prev) => ({
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    role: "assistant",
                    content: `Unknown command: /${commandName}. Type /help for available commands.`,
                  },
                ],
              }));
            }
          } catch (error) {
            setAppState((prev) => ({
              ...prev,
              messages: [
                ...prev.messages,
                {
                  role: "assistant",
                  content: `Unknown command: /${commandName}. Type /help for available commands.`,
                },
              ],
            }));
          }
        }
      } else if ((appState as any).configEditState?.active) {
        // In interactive config edit mode - pass plain input to config command
        const context = {
          session: appState.session,
          appState,
          setAppState,
        };

        try {
          await executeCommand("config", [input_val], context);
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          setAppState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: "assistant",
                content: `❌ Error: ${errorMsg}`,
              },
            ],
          }));
        }
      } else {
        // Regular message - send to AI model
        const session = appState.session;

        // Append user message to session history
        session.appendUser(input_val);

        // Mark assistant as responding
        setAppState((prev) => ({
          ...prev,
          isAssistantResponding: true,
        }));

        // Send to model and stream response
        let assistantResponse = "";
        try {
          // Get tools for OpenAI function calling (only for models with native support).
          // Non-native models (e.g. Ollama/Gemma via LiteLLM) fall back to prompt injection
          // which forces format:json on every response, breaking plain conversational replies.
          const supportsNativeTools =
            session.config.model?.nativeToolSupport === true;
          const allTools = supportsNativeTools
            ? session.toolRegistry.getCompressedTools()
            : [];
          const formattedTools =
            supportsNativeTools && allTools && allTools.length > 0
              ? allTools.map((tool) => ({
                  type: "function" as const,
                  function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.inputSchema,
                  },
                }))
              : undefined;

          const result = await streamChatCompletion({
            baseUrl: session.config.baseUrl || "https://api.openai.com/v1",
            apiKey: session.config.apiKey,
            anthropicApiKey: session.config.anthropicApiKey,
            geminiApiKey: session.config.geminiApiKey,
            ollamaBaseUrl: session.config.ollamaBaseUrl,
            providerType: session.config.model?.providerType,
            model: session.config.model?.id || "gpt-4",
            messages: session.history,
            signal: session.abortController.signal,
            onDelta: (chunk) => {
              assistantResponse += chunk;
              setAppState((prev) => {
                // Check if the last message is already an assistant response
                const lastMsg = prev.messages[prev.messages.length - 1];
                const hasAssistantResponse =
                  lastMsg && lastMsg.role === "assistant";

                // If no assistant response yet, add one; otherwise update existing
                const updatedMessages: Array<{
                  role: "user" | "assistant";
                  content: string;
                }> = hasAssistantResponse
                  ? [
                      ...prev.messages.slice(0, -1), // Remove old assistant response
                      {
                        role: "assistant" as const,
                        content: assistantResponse,
                      },
                    ]
                  : [
                      ...prev.messages, // Keep user message
                      {
                        role: "assistant" as const,
                        content: assistantResponse,
                      },
                    ];

                return {
                  ...prev,
                  messages: updatedMessages,
                };
              });
            },
            tools: formattedTools,
          });

          // Use structured tool calls from the streaming parser (Phase 2).
          // appendAssistantWithTools stores a content-array message when tool
          // calls are present so the model can reference them next turn.
          session.appendAssistantWithTools(assistantResponse, result.toolCalls);

          // ── Warn when native-tool model returned no structured calls ─────
          // Only fires when the response text shows the model *tried* to use a
          // tool via text syntax (INVOKE_SKILL / action verbs) but no structured
          // call was emitted — i.e. the model hallucinated the action.
          const toolAttemptPattern =
            /INVOKE_SKILL:|INVOKE_TOOL:|\bI (?:have |will |am )?(?:edited|wrote|created|inserted|deleted|updated|written|saved|modified)\b/i;
          if (
            supportsNativeTools &&
            result.toolsProvided &&
            result.toolCalls.length === 0 &&
            toolAttemptPattern.test(assistantResponse)
          ) {
            setAppState((prev) => ({
              ...prev,
              messages: [
                ...prev.messages,
                {
                  role: "assistant" as const,
                  content:
                    `⚠️ The model described an action but did not emit a structured tool call — nothing was executed.\n` +
                    `Try rephrasing your request, or ask the model to explicitly use its tools.`,
                },
              ],
            }));
          }
          // When the model is not capable of OpenAI function calling, it uses
          // the INVOKE_SKILL: <name> text syntax instead.  We detect that here,
          // load the skill content, inject it into history, and re-run once so
          // the model can complete the task with the skill instructions in scope.
          if (!supportsNativeTools && result.toolCalls.length === 0) {
            const invokeMatch = assistantResponse
              .trim()
              .match(/^INVOKE_SKILL:\s*(\S+)$/m);
            if (invokeMatch) {
              const skillName = invokeMatch[1]!;
              const skillResult = await invokeSkill(skillName, session.modes);
              const skillContent = skillResult.success
                ? (skillResult.content ??
                  `Skill '${skillName}' has no content.`)
                : `Error loading skill '${skillName}': ${skillResult.error}`;

              // Show skill-injection indicator
              setAppState((prev) => ({
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    role: "assistant" as const,
                    content: `📚 Skill injected: ${skillName}`,
                  },
                ],
              }));

              // Inject the skill instructions so the model can act on them
              session.appendUser(
                `[Skill: ${skillName}]\n\n${skillContent}\n\nUsing the above skill instructions, please complete the original request.`,
              );

              // Re-run the model once with skill context in history
              let skillFollowUpText = "";
              await streamChatCompletion({
                baseUrl: session.config.baseUrl || "https://api.openai.com/v1",
                apiKey: session.config.apiKey,
                anthropicApiKey: session.config.anthropicApiKey,
                geminiApiKey: session.config.geminiApiKey,
                ollamaBaseUrl: session.config.ollamaBaseUrl,
                providerType: session.config.model?.providerType,
                model: session.config.model?.id || "gpt-4",
                messages: session.history,
                signal: session.abortController.signal,
                onDelta: (chunk) => {
                  skillFollowUpText += chunk;
                  setAppState((prev) => {
                    const lastMsg = prev.messages[prev.messages.length - 1];
                    const base =
                      lastMsg?.role === "assistant"
                        ? prev.messages.slice(0, -1)
                        : prev.messages;
                    return {
                      ...prev,
                      messages: [
                        ...base,
                        {
                          role: "assistant" as const,
                          content: skillFollowUpText,
                        },
                      ],
                    };
                  });
                },
              });

              session.appendAssistant(skillFollowUpText);
            }
          }

          // ── Multi-turn tool-call loop ────────────────────────────────────
          // Run up to MAX_TOOL_TURNS back-and-forth until the model stops
          // requesting tools or the cap is reached.
          const MAX_TOOL_TURNS = 5;
          let turnResult = result;

          for (
            let turn = 0;
            turn < MAX_TOOL_TURNS && turnResult.toolCalls.length > 0;
            turn++
          ) {
            const pendingCalls = turnResult.toolCalls;
            const toolNames = pendingCalls.map((t) => t.name).join(", ");

            // Show execution indicator while tools run
            setAppState((prev) => ({
              ...prev,
              messages: [
                ...prev.messages,
                {
                  role: "assistant" as const,
                  content: `⚙️ Running: ${toolNames}…`,
                },
              ],
            }));

            // ToolUseContentPart is structurally identical to ToolUseBlock —
            // no explicit cast required by TypeScript's structural typing.
            const toolResults =
              await session.toolDispatcher.dispatchToolCalls(pendingCalls);

            // Persist results as structured role:"tool" history messages.
            // ToolResult is structurally identical to ToolResultContentPart.
            session.appendToolResults(toolResults);

            // Stream the follow-up model response with the updated history
            let followUpText = "";
            turnResult = await streamChatCompletion({
              baseUrl: session.config.baseUrl || "https://api.openai.com/v1",
              apiKey: session.config.apiKey,
              anthropicApiKey: session.config.anthropicApiKey,
              geminiApiKey: session.config.geminiApiKey,
              ollamaBaseUrl: session.config.ollamaBaseUrl,
              providerType: session.config.model?.providerType,
              model: session.config.model?.id || "gpt-4",
              messages: session.history,
              signal: session.abortController.signal,
              onDelta: (chunk) => {
                followUpText += chunk;
                setAppState((prev) => {
                  // Replace the last assistant message (⚙️ indicator or
                  // previous partial text) so the UI shows live output.
                  const lastMsg = prev.messages[prev.messages.length - 1];
                  const base =
                    lastMsg?.role === "assistant"
                      ? prev.messages.slice(0, -1)
                      : prev.messages;
                  return {
                    ...prev,
                    messages: [
                      ...base,
                      { role: "assistant" as const, content: followUpText },
                    ],
                  };
                });
              },
              tools: formattedTools,
            });

            session.appendAssistantWithTools(
              followUpText,
              turnResult.toolCalls,
            );
          }

          // Update final state
          setAppState((prev) => ({
            ...prev,
            isAssistantResponding: false,
          }));
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          setAppState((prev) => ({
            ...prev,
            isAssistantResponding: false,
            messages: [
              ...prev.messages,
              {
                role: "assistant",
                content: `❌ Error: ${errorMsg}`,
              },
            ],
          }));
          if (process.env.DEBUG) {
            cliWarn("Debug: Model request failed", errorMsg);
          }
        }
      }
      return;
    }

    // Regular character input
    if (!key.ctrl && !key.meta && !key.shift) {
      setAppState((prev) => ({
        ...prev,
        inputValue: prev.inputValue + input,
      }));
    }
  });

  const modeLabel = appState.session.modes.map((m: any) => m.name).join(" + ");
  const modelLabel =
    appState.session.config.model?.label ??
    appState.session.config.model?.id ??
    "unknown";
  const responding = appState.isAssistantResponding;
  // True when AI is processing but no response delta arrived yet
  const awaitingFirstDelta =
    responding &&
    appState.messages[appState.messages.length - 1]?.role === "user";

  // ── Selector overlay ─────────────────────────────────────────
  if (appState.selector) {
    return (
      <Box flexDirection="column" height={termRows}>
        <Box flexDirection="column" overflow="hidden" flexGrow={1}>
          <Select
            options={appState.selector.options}
            label={appState.selector.title}
            initialFocusIndex={appState.selector.initialFocusIndex ?? 0}
            onSelect={(value) => {
              const handler = appState.selector!.onSelect;
              setAppState((prev) => ({ ...prev, selector: null }));
              handler(value);
            }}
            onCancel={() => {
              const handler = appState.selector?.onCancel;
              setAppState((prev) => ({ ...prev, selector: null }));
              handler?.();
            }}
          />
        </Box>
      </Box>
    );
  }

  // ── Text input prompt overlay ─────────────────────────────────
  if (appState.prompter) {
    return (
      <Box flexDirection="column" height={termRows}>
        <Box flexDirection="column" overflow="hidden" flexGrow={1}>
          <TextInput
            label={appState.prompter.label}
            placeholder={appState.prompter.placeholder}
            initialValue={appState.prompter.initialValue}
            onSubmit={(value) => {
              const handler = appState.prompter!.onSubmit;
              setAppState((prev) => ({ ...prev, prompter: null }));
              handler(value);
            }}
            onCancel={() => {
              const handler = appState.prompter?.onCancel;
              setAppState((prev) => ({ ...prev, prompter: null }));
              handler?.();
            }}
          />
        </Box>
      </Box>
    );
  }

  return (
    /*
     * ROOT LAYOUT CONTRACT — DO NOT BREAK
     * ─────────────────────────────────────────────────────────
     * height={termRows} pins the entire UI to the terminal height.
     * Every direct child EXCEPT <ScrollBox> must have flexShrink={0}
     * so Yoga never steals their space to satisfy the height constraint.
     * Only the ScrollBox is allowed to grow/shrink (flexGrow={1}).
     * Breaking this causes the input box to vanish when messages fill up.
     * ─────────────────────────────────────────────────────────
     */
    <Box flexDirection="column" height={termRows}>
      {/* ══════════════════════════════════════════════════════════
          HEADER — brand bar with bordered box
          flexShrink={0}: never compress, always show full header
          ══════════════════════════════════════════════════════════ */}
      <Box
        borderStyle="single"
        borderColor={responding ? COLORS.border : COLORS.brand}
        flexDirection="row"
        flexShrink={0}
        paddingX={1}
      >
        {/* App icon + name */}
        <Text bold color={COLORS.brand}>
          ⬡ Ryft
        </Text>

        <Text color={COLORS.dim}> · </Text>

        {/* Mode */}
        <Text bold color={COLORS.mode}>
          {modeLabel}
        </Text>

        <Text color={COLORS.dim}> · </Text>

        {/* Model */}
        <Text color={COLORS.model}>{modelLabel}</Text>

        {/* Spinner (only when responding) */}
        {responding && (
          <>
            <Text color={COLORS.dim}> · </Text>
            <Text color={COLORS.warningBright} bold>
              {SPINNER_FRAMES[spinnerFrame]}
            </Text>
            <Text color={COLORS.warning}> responding…</Text>
          </>
        )}
      </Box>

      {/* ══════════════════════════════════════════════════════════
          MESSAGES — ScrollBox is the ONLY element allowed to grow/shrink.
          flexGrow={1}: fill all space not claimed by fixed siblings.
          ══════════════════════════════════════════════════════════ */}
      <ScrollBox
        ref={scrollRef}
        flexDirection="column"
        flexGrow={1}
        flexShrink={1}
        paddingX={2}
        paddingTop={1}
        stickyScroll={stickyRef.current}
      >
        {appState.messages.length === 0 ? (
          /* Empty state */
          <Box
            flexDirection="column"
            paddingX={2}
            paddingY={1}
            borderStyle="round"
            borderColor={COLORS.border}
          >
            <Text bold color={COLORS.brand}>
              Welcome to Ryft ⬡
            </Text>
            <Text color={COLORS.dim}>─────────────────────────</Text>
            <Box marginTop={1}>
              <Text color={COLORS.dim}> Send a message or type </Text>
              <Text bold color={COLORS.assistant}>
                /help
              </Text>
              <Text color={COLORS.dim}> to get started.</Text>
            </Box>
          </Box>
        ) : (
          appState.messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            const isError = msg.content.startsWith("❌");
            const isToolCall =
              msg.content.startsWith("⚙️") || msg.content.startsWith("⚙");
            const isSkill = msg.content.startsWith("📚");

            const barColor = isError
              ? COLORS.errorBright
              : isToolCall
                ? COLORS.warningBright
                : isSkill
                  ? COLORS.success
                  : isUser
                    ? COLORS.user
                    : COLORS.assistant;

            const contentColor = isError
              ? COLORS.error
              : isToolCall
                ? COLORS.warning
                : isSkill
                  ? COLORS.success
                  : isUser
                    ? COLORS.user // user text: green
                    : COLORS.assistantText; // assistant text: cyan (distinct from white!)

            return (
              <Box
                key={idx}
                flexDirection="row"
                marginBottom={1}
                alignItems="flex-start"
              >
                {/* Colored vertical bar */}
                <Text color={barColor} bold>
                  {"▍"}
                </Text>
                <Box flexDirection="column" paddingLeft={1} flexGrow={1}>
                  {/* Role label */}
                  <Text bold color={barColor}>
                    {isUser
                      ? "you"
                      : isToolCall
                        ? "tool"
                        : isSkill
                          ? "skill"
                          : "ryft"}
                  </Text>
                  {/* Message body */}
                  <Text color={contentColor} wrap="wrap">
                    {msg.content}
                  </Text>
                </Box>
              </Box>
            );
          })
        )}

        {/* Inline spinner — shows when waiting for first delta */}
        {awaitingFirstDelta && (
          <Box flexDirection="row" alignItems="flex-start">
            <Text color={COLORS.warningBright} bold>
              {"▍"}
            </Text>
            <Box flexDirection="column" paddingLeft={1}>
              <Text bold color={COLORS.assistant}>
                ryft
              </Text>
              <Text color={COLORS.warningBright}>
                {SPINNER_FRAMES[spinnerFrame]}{" "}
              </Text>
              <Text color={COLORS.warning}>generating response…</Text>
            </Box>
          </Box>
        )}
      </ScrollBox>

      {/* ── Scroll hint — flexShrink={0}: keep this row visible ── */}
      {!stickyRef.current && (
        <Box paddingX={2} flexShrink={0}>
          <Text color={COLORS.scrollHint} bold>
            ↓{" "}
          </Text>
          <Text color={COLORS.dim}>scroll to latest</Text>
          <Text color={COLORS.hint}> (↑↓ PgUp/PgDn)</Text>
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════
          INPUT — flexShrink={0} is CRITICAL.
          Without it, Yoga compresses this box when ScrollBox fills the
          terminal, making the input invisible or untyp-able.
          minHeight={3} = 1 content row + 2 border rows (top+bottom).
          ══════════════════════════════════════════════════════════ */}
      <Box
        borderStyle="round"
        borderColor={
          responding ? COLORS.inputBorderWaiting : COLORS.inputBorder
        }
        paddingX={1}
        marginX={0}
        marginTop={0}
        flexDirection="row"
        flexShrink={0}
        minHeight={3}
      >
        <Text bold color={responding ? COLORS.dim : COLORS.user}>
          ›
        </Text>
        <Text> </Text>
        {appState.inputValue ? (
          <>
            <Text color="white" wrap="wrap">
              {appState.inputValue}
            </Text>
            {appState.promptSuggestion.text && (
              <Text color={COLORS.dim}>
                {appState.promptSuggestion.text.slice(
                  appState.inputValue.length,
                )}
              </Text>
            )}
          </>
        ) : (
          <Text dimColor>
            {responding ? "waiting for response…" : "type a message…"}
          </Text>
        )}
        {!responding && (
          <Text color={COLORS.user} bold>
            ▌
          </Text>
        )}
      </Box>

      {/* ── Tab suggestion hint — flexShrink={0}: never get squished ── */}
      {appState.promptSuggestion.text && (
        <Box paddingX={3} marginBottom={0} flexShrink={0}>
          <Text color={COLORS.hint}>tab </Text>
          <Text color={COLORS.border}>→ </Text>
          <Text color={COLORS.assistant}>{appState.promptSuggestion.text}</Text>
        </Box>
      )}
    </Box>
  );
};
