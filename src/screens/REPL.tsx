/**
 * REPL Screen — main interaction loop for the CLI
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Text,
  useInput,
  ScrollBox,
  type ScrollBoxHandle,
} from "../ink.ts";
import { useAppState, useSetAppState } from "../state/AppState.tsx";
import { getFeatureLogger } from "../logging/index.ts";
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
import { buildFormattedTools } from "../runtime/toolFormatter.ts";
import { streamChatCompletion } from "../runtime/llmClient.ts";
import { createAbortController } from "../runtime/util.ts";
import { invokeSkill } from "../tools/skill-tool.ts";
import { promises as fs } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { COLORS, SPINNER_FRAMES, SPINNER_INTERVAL_MS } from "../ui/theme.ts";
import {
  ToolCallPreview,
  type ToolCallEntry,
  type ToolCallStatus,
} from "../components/ToolCallPreview.tsx";
import { diffLines } from "../ui/diff.ts";
import type { FileChange } from "../hooks/useTurnDiffs.ts";

const log = getFeatureLogger("REPL");

initializeCommands();

// ── Module-level constants ────────────────────────────────────────────────────

const MAX_TOOL_TURNS = 1000;
// Max retries when model returns empty (no text + no tool calls) mid-loop
const MAX_EMPTY_RETRIES = 3;

const TOOL_ATTEMPT_PATTERN =
  /INVOKE_SKILL:|INVOKE_TOOL:|\bI (?:have |will |am )?(?:edited|wrote|created|inserted|deleted|updated|written|saved|modified)\b/i;

// ── File-diff helpers ─────────────────────────────────────────────────────────

/** Returns the absolute path for a file-tool input, or null if not found. */
function getFilePath(input: Record<string, unknown>): string | null {
  const v =
    input["path"] ??
    input["file"] ??
    input["filePath"] ??
    input["file_path"] ??
    null;
  if (typeof v !== "string" || v.length === 0) return null;
  const cwd = process.env["RYFT_ORIGINAL_CWD"] || process.cwd();
  return resolvePath(cwd, v);
}

/** Returns the display (relative) path from tool input, or null. */
function getRawPath(input: Record<string, unknown>): string | null {
  const v =
    input["path"] ??
    input["file"] ??
    input["filePath"] ??
    input["file_path"] ??
    null;
  return typeof v === "string" && v.length > 0 ? v : null;
}

async function safeReadFile(absPath: string): Promise<string> {
  try {
    return await fs.readFile(absPath, "utf8");
  } catch {
    return "";
  }
}

type FileEditCapture = {
  displayPath: string;
  absPath: string;
  before: string;
  after: string | null; // null = read from disk after dispatch
};

/** Pre-compute what a file-write tool will change, using input directly where possible. */
async function captureFileEdit(
  tcName: string,
  tcInput: Record<string, unknown>,
): Promise<FileEditCapture | null> {
  const absPath = getFilePath(tcInput);
  if (!absPath) return null;
  const displayPath = getRawPath(tcInput) ?? absPath;
  const n = tcName.toLowerCase();

  const before = await safeReadFile(absPath);

  // write_file / create_file: after content = input.content
  if (n.includes("write") || n.includes("create")) {
    const content = tcInput["content"];
    if (typeof content === "string") {
      return { displayPath, absPath, before, after: content };
    }
  }

  // str_replace_in_file / str_replace: apply old→new in memory
  if (
    n.includes("str_replace") ||
    n.includes("replace") ||
    n.includes("edit")
  ) {
    const oldStr =
      tcInput["old_str"] ?? tcInput["old_string"] ?? tcInput["old"];
    const newStr =
      tcInput["new_str"] ??
      tcInput["new_string"] ??
      tcInput["new"] ??
      tcInput["replacement"] ??
      "";
    if (typeof oldStr === "string") {
      const after = before.replace(
        oldStr,
        typeof newStr === "string" ? newStr : "",
      );
      return { displayPath, absPath, before, after };
    }
  }

  // Generic write tool: read file from disk after dispatch
  return { displayPath, absPath, before, after: null };
}

export const REPL: React.FC = () => {
  const appState = useAppState();
  const setAppState = useSetAppState();

  // Refs — survive re-renders without triggering them
  const initializedRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<ScrollBoxHandle>(null);
  const stickyRef = useRef(true);
  // Always-fresh appState snapshot for useInput (avoids stale closures)
  const appStateRef = useRef(appState);

  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [termRows, setTermRows] = useState<number>(process.stdout.rows ?? 24);
  const [termCols, setTermCols] = useState<number>(
    process.stdout.columns ?? 80,
  );

  // Keep appStateRef in sync on every render
  appStateRef.current = appState;

  // ── Terminal resize ───────────────────────────────────────────────────────
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

  // ── Spinner animation — runs whenever the assistant or mode-switch is active
  useEffect(() => {
    if (!appState.isAssistantResponding && !appState.isSwitchingMode) return;
    const id = setInterval(
      () => setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length),
      SPINNER_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [appState.isAssistantResponding, appState.isSwitchingMode]);

  // ── One-time session initialization ──────────────────────────────────────
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const session = appStateRef.current.session;
    buildSystemPrompt(session).then((systemPrompt) => {
      session.history.unshift({ role: "system", content: systemPrompt });
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
    });
  }, [setAppState]);

  // ── Debounced command suggestion ──────────────────────────────────────────
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      const suggestion = appState.inputValue.startsWith("/")
        ? (filterCommands(appState.inputValue)[0]?.command ?? null)
        : null;
      setAppState((prev) => ({
        ...prev,
        promptSuggestion: {
          text: suggestion,
          shownAt: suggestion ? Date.now() : 0,
        },
      }));
    }, 100);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [appState.inputValue, setAppState]);

  // ── Auto-scroll to bottom on new messages (sticky) ───────────────────────
  useEffect(() => {
    if (stickyRef.current) scrollRef.current?.scrollToBottom();
  }, [appState.messages.length]);

  // ── AI streaming pipeline ─────────────────────────────────────────────────
  // Extracted as a stable callback to keep useInput lean.
  const runAiTurn = useCallback(
    async (inputText: string) => {
      const session = appStateRef.current.session;
      const formattedTools = buildFormattedTools(session);
      const supportsNativeTools =
        session.config.model?.nativeToolSupport === true;

      // Shared config for every streamChatCompletion call in this turn
      const baseStreamConfig = {
        baseUrl: session.config.baseUrl || "https://api.openai.com/v1",
        apiKey: session.config.apiKey,
        anthropicApiKey: session.config.anthropicApiKey,
        geminiApiKey: session.config.geminiApiKey,
        ollamaBaseUrl: session.config.ollamaBaseUrl,
        providerType: session.config.model?.providerType,
        model: session.config.model?.id || "gpt-4",
        signal: session.abortController.signal,
      };

      // Helper: replace or append the last assistant message while streaming.
      // If the last message is a tool-calls entry, always append a new one.
      const patchLastAssistant = (text: string) => {
        setAppState((prev) => {
          const last = prev.messages[prev.messages.length - 1];
          // If last message is a tool-calls block, append new assistant message
          if (last?.role === "tool-calls") {
            return {
              ...prev,
              messages: [
                ...prev.messages,
                { role: "assistant" as const, content: text },
              ],
            };
          }
          // Otherwise replace the last assistant message if it exists
          const base =
            last?.role === "assistant"
              ? prev.messages.slice(0, -1)
              : prev.messages;
          return {
            ...prev,
            messages: [...base, { role: "assistant" as const, content: text }],
          };
        });
      };

      session.appendUser(inputText);
      setAppState((prev) => ({ ...prev, isAssistantResponding: true }));

      try {
        let assistantResponse = "";
        const result = await streamChatCompletion({
          ...baseStreamConfig,
          messages: session.history,
          tools: formattedTools,
          onDelta: (chunk) => {
            assistantResponse += chunk;
            patchLastAssistant(assistantResponse);
          },
        });

        session.appendAssistantWithTools(assistantResponse, result.toolCalls);

        // Warn when a native-tool model hallucinated an action via text instead of a call
        if (
          supportsNativeTools &&
          result.toolsProvided &&
          result.toolCalls.length === 0 &&
          TOOL_ATTEMPT_PATTERN.test(assistantResponse)
        ) {
          setAppState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: "assistant" as const,
                content:
                  "⚠️ The model described an action but did not emit a structured tool call — nothing was executed.\n" +
                  "Try rephrasing your request, or ask the model to explicitly use its tools.",
              },
            ],
          }));
        }

        // Text-based INVOKE_SKILL fallback for non-native-tool models
        if (!supportsNativeTools && result.toolCalls.length === 0) {
          const invokeMatch = assistantResponse
            .trim()
            .match(/^INVOKE_SKILL:\s*(\S+)$/m);
          if (invokeMatch) {
            const skillName = invokeMatch[1]!;
            const skillResult = await invokeSkill(skillName, session.modes);
            const skillContent = skillResult.success
              ? (skillResult.content ?? `Skill '${skillName}' has no content.`)
              : `Error loading skill '${skillName}': ${skillResult.error}`;

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

            session.appendUser(
              `[Skill: ${skillName}]\n\n${skillContent}\n\nUsing the above skill instructions, please complete the original request.`,
            );

            let skillFollowUpText = "";
            await streamChatCompletion({
              ...baseStreamConfig,
              messages: session.history,
              onDelta: (chunk) => {
                skillFollowUpText += chunk;
                patchLastAssistant(skillFollowUpText);
              },
            });

            session.appendAssistant(skillFollowUpText);
          }
        }

        // Multi-turn tool-call loop — up to MAX_TOOL_TURNS round-trips
        let turnResult = result;
        for (
          let turn = 0;
          turn < MAX_TOOL_TURNS && turnResult.toolCalls.length > 0;
          turn++
        ) {
          const pendingCalls = turnResult.toolCalls;

          // Build structured tool call entries for the preview
          const toolEntries: ToolCallEntry[] = pendingCalls.map((tc) => {
            const registryMatches = session.toolRegistry.getToolsByName(
              tc.name,
            );
            const source =
              registryMatches.length > 0
                ? registryMatches[0]!.serverId
                : "unknown";
            return {
              id: tc.id,
              name: tc.name,
              source,
              input: tc.input as Record<string, unknown>,
              status: "pending" as const,
            };
          });

          // Push tool-calls message into chat
          setAppState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: "tool-calls" as const,
                content: "" as const,
                entries: toolEntries,
              },
            ],
          }));

          // Capture file content BEFORE tool execution for diff computation
          const fileEditMap = new Map<string, FileEditCapture>();
          await Promise.all(
            pendingCalls.map(async (tc) => {
              const capture = await captureFileEdit(
                tc.name,
                tc.input as Record<string, unknown>,
              );
              if (capture) fileEditMap.set(tc.id, capture);
            }),
          );

          const toolResults =
            await session.toolDispatcher.dispatchToolCalls(pendingCalls);
          session.appendToolResults(toolResults);

          // Update entries with results in-place (last tool-calls message)
          const completedEntries: ToolCallEntry[] = await Promise.all(
            toolEntries.map(async (entry) => {
              const result = toolResults.find(
                (r) => r.tool_use_id === entry.id,
              );
              if (!result) return { ...entry, status: "success" as const };
              // Preserve newlines so the preview can render multi-line output
              const preview =
                typeof result.content === "string" ? result.content.trim() : "";

              // Compute diff for file-write tools
              let fileChanges: FileChange[] | undefined;
              const capture = fileEditMap.get(entry.id);
              if (capture && !result.is_error) {
                // If after is pre-computed from input, use it; otherwise read from disk
                const after =
                  capture.after !== null
                    ? capture.after
                    : await safeReadFile(capture.absPath);
                const hunks = diffLines(capture.before, after);
                if (hunks.length > 0) {
                  fileChanges = [
                    {
                      path: capture.displayPath,
                      before: capture.before,
                      after,
                      hunks,
                    },
                  ];
                }
              }

              return {
                ...entry,
                status: (result.is_error
                  ? "error"
                  : "success") as ToolCallStatus,
                resultPreview: preview || undefined,
                isError: result.is_error ?? false,
                fileChanges,
              };
            }),
          );

          // Update the last tool-calls message with completed entries
          setAppState((prev) => {
            const msgs = [...prev.messages];
            const lastIdx = msgs.length - 1;
            const last = msgs[lastIdx];
            if (last && last.role === "tool-calls") {
              msgs[lastIdx] = {
                role: "tool-calls" as const,
                content: "" as const,
                entries: completedEntries,
              };
            }
            return { ...prev, messages: msgs };
          });

          let followUpText = "";
          turnResult = await streamChatCompletion({
            ...baseStreamConfig,
            messages: session.history,
            tools: formattedTools,
            onDelta: (chunk) => {
              followUpText += chunk;
              patchLastAssistant(followUpText);
            },
          });

          // User cancelled during this stream — bail out of the tool loop cleanly
          if (session.abortController.signal.aborted) {
            session.appendAssistantWithTools(followUpText, []);
            break;
          }

          // Retry when model returns completely empty (no text AND no tool calls)
          let emptyRetries = 0;
          while (
            followUpText.trim() === "" &&
            turnResult.toolCalls.length === 0 &&
            emptyRetries < MAX_EMPTY_RETRIES &&
            !session.abortController.signal.aborted
          ) {
            emptyRetries++;
            log.warn(
              `Model returned empty response in tool loop, retrying (${emptyRetries}/${MAX_EMPTY_RETRIES})`,
            );
            session.appendUser("Continue.");
            followUpText = "";
            turnResult = await streamChatCompletion({
              ...baseStreamConfig,
              messages: session.history,
              tools: formattedTools,
              onDelta: (chunk) => {
                followUpText += chunk;
                patchLastAssistant(followUpText);
              },
            });
          }

          if (
            followUpText.trim() === "" &&
            turnResult.toolCalls.length === 0 &&
            !session.abortController.signal.aborted
          ) {
            setAppState((prev) => ({
              ...prev,
              messages: [
                ...prev.messages,
                {
                  role: "assistant" as const,
                  content:
                    "⚠️ The model stopped responding mid-task (empty response after tool calls). " +
                    'Try typing "continue" to resume, or rephrase your request.',
                },
              ],
            }));
          }

          session.appendAssistantWithTools(followUpText, turnResult.toolCalls);
        }

        setAppState((prev) => ({ ...prev, isAssistantResponding: false }));
        // Always reset AbortController after a completed (or aborted) turn
        session.abortController = createAbortController();
      } catch (error) {
        const isAbortError =
          error instanceof Error && error.name === "AbortError";

        if (!isAbortError) {
          // Only show error message for non-abort errors
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          log.error(`LLM stream error: ${errorMsg}`);
          setAppState((prev) => ({
            ...prev,
            isAssistantResponding: false,
            messages: [
              ...prev.messages,
              { role: "assistant", content: `❌ Error: ${errorMsg}` },
            ],
          }));
          if (process.env.DEBUG)
            cliWarn("Debug: Model request failed", errorMsg);
        } else {
          // For abort errors, just ensure response state is cleared
          setAppState((prev) => ({
            ...prev,
            isAssistantResponding: false,
          }));
        }

        // Reset AbortController for the next request
        const session = appStateRef.current.session;
        session.abortController = createAbortController();
      }
    },
    [setAppState],
  );

  // ── Keyboard input ────────────────────────────────────────────────────────
  useInput(async (input, key) => {
    const state = appStateRef.current;

    // Overlays consume all input
    if (state.selector || state.prompter) return;

    if ((key.ctrl && input === "c") || (key.ctrl && input === "d")) {
      process.exit(0);
    }

    // Scroll
    if (key.upArrow) {
      stickyRef.current = false;
      scrollRef.current?.scrollBy(-3);
      return;
    }
    if (key.downArrow) {
      const h = scrollRef.current;
      if (h) {
        const atBottom =
          h.getScrollTop() + h.getViewportHeight() >= h.getScrollHeight() - 1;
        if (atBottom) {
          stickyRef.current = true;
          h.scrollToBottom();
        } else h.scrollBy(3);
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
      const h = scrollRef.current;
      if (h) {
        const atBottom =
          h.getScrollTop() + h.getViewportHeight() >= h.getScrollHeight() - 1;
        if (atBottom) {
          stickyRef.current = true;
          h.scrollToBottom();
        } else h.scrollBy(h.getViewportHeight());
      }
      return;
    }

    // Tab — accept inline suggestion
    if (key.tab) {
      if (state.promptSuggestion.text) {
        setAppState((prev) => ({
          ...prev,
          inputValue: prev.promptSuggestion.text!,
          promptSuggestion: { text: null, shownAt: 0 },
        }));
      }
      return;
    }

    // ESC — cancel response generation
    if (key.escape) {
      if (state.isAssistantResponding) {
        setAppState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "assistant" as const,
              content: "⏹️ Response generation cancelled.",
            },
          ],
        }));
        state.session.abortController.abort();
      }
      return;
    }

    // Backspace — covers all terminal encodings
    const charCode = input?.charCodeAt(0);
    const isBackspace =
      key.backspace ||
      key.delete ||
      (key.ctrl && input === "h") ||
      charCode === 8 ||
      charCode === 127;

    if (isBackspace) {
      setAppState((prev) => ({
        ...prev,
        inputValue: prev.inputValue.slice(0, -1),
      }));
      return;
    }

    // Enter — submit
    if (key.return) {
      if (state.isSwitchingMode || state.isAssistantResponding) return;

      const text = state.inputValue.trim();
      if (!text) return;

      // Commit user message and clear input
      setAppState((prev) => ({
        ...prev,
        messages: [...prev.messages, { role: "user", content: text }],
        inputValue: "",
        promptSuggestion: { text: null, shownAt: 0 },
      }));

      if (text.startsWith("/")) {
        // ── Command dispatch ──────────────────────────────────────
        const [commandName, ...args] = text.slice(1).split(" ");
        const command = findCommand(commandName);

        if (command) {
          const context = {
            session: state.session,
            appState: state,
            setAppState,
          };
          canExecuteCommand(commandName, context)
            .then(async (allowed) => {
              if (!allowed) {
                const reason = await getCommandBlockReason(
                  commandName,
                  context,
                );
                setAppState((prev) => ({
                  ...prev,
                  messages: [
                    ...prev.messages,
                    {
                      role: "assistant",
                      content: `❌ Permission denied: ${reason ?? `Command '${commandName}' is not allowed in current context`}`,
                    },
                  ],
                }));
                return;
              }
              try {
                await executeCommand(commandName, args, context);
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setAppState((prev) => ({
                  ...prev,
                  messages: [
                    ...prev.messages,
                    {
                      role: "assistant",
                      content: `❌ Error executing ${commandName}: ${msg}`,
                    },
                  ],
                }));
                if (process.env.DEBUG)
                  cliWarn(`Debug: Command '${commandName}' failed`, msg);
              }
            })
            .catch((err) => {
              setAppState((prev) => ({
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    role: "assistant",
                    content: `❌ Error checking permissions: ${err instanceof Error ? err.message : String(err)}`,
                  },
                ],
              }));
            });
        } else {
          // Unknown slash — try as skill invocation
          invokeSkill(commandName, state.session.modes)
            .then((skillResult) => {
              const content =
                skillResult.success && skillResult.content
                  ? `📚 Skill: ${commandName}\n\n${skillResult.content}`
                  : `Unknown command: /${commandName}. Type /help for available commands.`;
              setAppState((prev) => ({
                ...prev,
                messages: [...prev.messages, { role: "assistant", content }],
              }));
            })
            .catch(() => {
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
            });
        }
      } else if ((state as any).configEditState?.active) {
        // ── Interactive config edit mode ──────────────────────────
        const context = {
          session: state.session,
          appState: state,
          setAppState,
        };
        executeCommand("config", [text], context).catch((err) => {
          setAppState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: "assistant",
                content: `❌ Error: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
          }));
        });
      } else {
        // ── AI turn ───────────────────────────────────────────────
        await runAiTurn(text);
      }
      return;
    }

    // Regular printable character
    if (!key.ctrl && !key.meta && !key.shift && input) {
      const code = input.charCodeAt(0);
      // Filter control chars, ESC, and ANSI escape sequences
      if (code < 32 || code === 27) return;
      setAppState((prev) => ({ ...prev, inputValue: prev.inputValue + input }));
    }
  });

  // ── Derived render values ─────────────────────────────────────────────────
  const modeLabel = appState.session.modes.map((m: any) => m.name).join(" + ");
  const modelLabel =
    appState.session.config.model?.label ??
    appState.session.config.model?.id ??
    "unknown";
  const responding = appState.isAssistantResponding;
  const switchingMode = appState.isSwitchingMode;
  const awaitingFirstDelta =
    responding &&
    appState.messages[appState.messages.length - 1]?.role === "user";

  // ── Selector overlay ──────────────────────────────────────────────────────
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

  // ── Text input prompt overlay ─────────────────────────────────────────────
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

        {/* Spinner (only when responding or switching mode) */}
        {(responding || switchingMode) && (
          <>
            <Text color={COLORS.dim}> · </Text>
            <Text color={COLORS.warningBright} bold>
              {SPINNER_FRAMES[spinnerFrame]}
            </Text>
            <Text color={COLORS.warning}>
              {switchingMode ? " loading tools…" : " responding…"}
            </Text>
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
            // ── tool-calls message — rendered inline, no bar ──
            if (msg.role === "tool-calls") {
              return (
                <Box
                  key={idx}
                  flexDirection="column"
                  marginBottom={1}
                  paddingLeft={2}
                >
                  <ToolCallPreview
                    entries={msg.entries}
                    spinnerFrame={spinnerFrame}
                    terminalWidth={termCols}
                  />
                </Box>
              );
            }

            const isUser = msg.role === "user";
            const isError = msg.content.startsWith("❌");
            const isSkill = msg.content.startsWith("📚");

            const barColor = isError
              ? COLORS.errorBright
              : isSkill
                ? COLORS.success
                : isUser
                  ? COLORS.user
                  : COLORS.assistant;

            const contentColor = isError
              ? COLORS.error
              : isSkill
                ? COLORS.success
                : isUser
                  ? COLORS.user
                  : COLORS.assistantText;

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
                    {isUser ? "you" : isSkill ? "skill" : "ryft"}
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
            {switchingMode
              ? "loading tools, please wait…"
              : responding
                ? "waiting for response…"
                : "type a message…"}
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
