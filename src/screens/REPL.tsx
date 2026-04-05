/**
 * REPL Screen
 * Main interaction loop for the CLI
 */

import React, { useEffect, useState, useRef } from "react";
import { Box, Text, useInput } from "../ink.ts";
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
import { streamChatCompletion } from "../runtime/openaiClient.ts";

// Initialize command system on import
initializeCommands();

export const REPL: React.FC = () => {
  const appState = useAppState();
  const setAppState = useSetAppState();
  const initializedRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize on first render only
    if (!initializedRef.current) {
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

  // Handle keyboard input
  useInput(async (input, key) => {
    // If selector is open, let it handle input
    if (appState.selector) {
      return;
    }

    // Handle Ctrl+C or Ctrl+D to exit
    if ((key.ctrl && input === "c") || (key.ctrl && input === "d")) {
      process.exit(0);
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
          const result = await streamChatCompletion({
            baseUrl: session.config.baseUrl || "https://api.openai.com/v1",
            apiKey: session.config.apiKey,
            model: session.config.model?.id || "gpt-4",
            messages: session.history,
            signal: session.abortController.signal,
            onDelta: (chunk) => {
              assistantResponse += chunk;
              setAppState((prev) => ({
                ...prev,
                messages: [
                  ...prev.messages.slice(0, -1), // Remove pending response if exists
                  {
                    role: "assistant",
                    content: assistantResponse,
                  },
                ],
              }));
            },
          });

          // Append assistant response to session history
          session.appendAssistant(assistantResponse);

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

  // Calculate heights for layout
  const suggestionHeight = appState.promptSuggestion.text ? 1 : 0;

  // If selector is open, show it instead of normal REPL
  if (appState.selector) {
    return (
      <Box flexDirection="column" width={100} height={30}>
        <Box flexDirection="column" flexGrow={1}>
          <Select
            options={appState.selector.options}
            label={appState.selector.title}
            initialFocusIndex={appState.selector.initialFocusIndex ?? 0}
            onSelect={(value) => {
              appState.selector!.onSelect(value);
              setAppState((prev) => ({
                ...prev,
                selector: null,
              }));
            }}
            onCancel={() => {
              appState.selector?.onCancel?.();
              setAppState((prev) => ({
                ...prev,
                selector: null,
              }));
            }}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={100} height={30}>
      {/* Messages area - show last 5 messages to ensure they fit */}
      <Box flexDirection="column" flexGrow={1} marginBottom={1}>
        {appState.messages.length > 0 ? (
          appState.messages.slice(-5).map((msg, idx) => (
            <Box key={idx} marginBottom={0}>
              <Text
                color={msg.role === "user" ? "cyan" : "green"}
                bold={msg.role === "assistant"}
              >
                {msg.role === "user" ? "> " : "< "}
              </Text>
              <Text wrap="wrap">{msg.content}</Text>
            </Box>
          ))
        ) : (
          <Text color="gray">No messages yet</Text>
        )}
      </Box>

      {/* Input area */}
      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        marginBottom={appState.promptSuggestion.text ? 1 : 0}
      >
        <Text color="yellow">$ </Text>
        <Text>{appState.inputValue}</Text>
        {appState.promptSuggestion.text && (
          <Text color="gray">
            {appState.promptSuggestion.text.slice(appState.inputValue.length)}
          </Text>
        )}
        <Text color="gray">_</Text>
      </Box>

      {/* Suggestions footer */}
      {appState.promptSuggestion.text && (
        <Box flexDirection="column" marginTop={0}>
          <Text color="gray" italic>
            Press Tab to accept: {appState.promptSuggestion.text}
          </Text>
        </Box>
      )}
    </Box>
  );
};
