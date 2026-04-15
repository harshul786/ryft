/**
 * Root Component
 * Top-level React component that mounts into Ink terminal
 * Sets up the application shell with all providers
 */

import React, { useMemo, useEffect } from "react";
import { Box } from "../ink.ts";
import { REPL } from "../screens/REPL.tsx";
import { AppStateProvider, createAppStore } from "../state/AppState.tsx";
import { getFeatureLogger } from "../logging/index.ts";
import type { Session } from "../runtime/session.ts";
import type { AppState } from "../state/AppStateStore.ts";

const log = getFeatureLogger("Root");

export interface RootProps {
  session: Session;
  initialState?: Partial<AppState>;
}

export const Root: React.FC<RootProps> = ({ session, initialState }) => {
  log.info("Root component rendering", {
    modes: session.modes.map((m) => m.name),
    model: session.config.model,
    hasInitialState: !!initialState,
    sessionId: (session as any).id || "unknown",
  });

  const store = useMemo(() => {
    log.info("Creating app store", {
      modes: session.modes.map((m) => m.name),
      sessionId: (session as any).id || "unknown",
    });
    const newStore = createAppStore({
      session,
      messages: [],
      inputValue: "",
      promptSuggestion: {
        text: null,
        shownAt: 0,
      },
      currentModel: session.config.model,
      isAssistantResponding: false,
      isSwitchingMode: false,
      selector: null,
      prompter: null,
      scrollOffset: 0,
      isScrolledToBottom: true,
      activeToolCalls: [],
      ...initialState,
    });
    log.info("Store created successfully", {
      modes: session.modes.map((m) => m.name),
      isSwitchingMode: initialState?.isSwitchingMode,
      sessionId: (session as any).id || "unknown",
    });
    return newStore;
  }, [initialState, session.modes.map((m) => m.name).join("-")]);

  // Track mode changes and input handling
  useEffect(() => {
    log.info("Root useEffect fired - will create store subscriptions", {
      modes: session.modes.map((m) => m.name),
      sessionId: (session as any).id || "unknown",
      timestamp: new Date().toISOString(),
    });

    // Subscribe to store updates for debugging
    if (store && typeof store.subscribe === "function") {
      const unsubscribe = store.subscribe((state: any) => {
        if (state.isSwitchingMode) {
          log.info("Mode switching in progress", {
            modes: state.modes,
            inputValue: state.inputValue?.substring?.(0, 50),
          });
        }
      });

      return () => {
        log.info("Root component cleanup - store unsubscribe");
        unsubscribe?.();
      };
    }
  }, [store, session]);

  return (
    <AppStateProvider store={store}>
      <Box flexDirection="column" width="100%" height="100%">
        <REPL />
      </Box>
    </AppStateProvider>
  );
};
