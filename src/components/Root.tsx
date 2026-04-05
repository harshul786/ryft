/**
 * Root Component
 * Top-level React component that mounts into Ink terminal
 * Sets up the application shell with all providers
 */

import React, { useMemo } from "react";
import { Box } from "../ink.ts";
import { REPL } from "../screens/REPL.tsx";
import { AppStateProvider, createAppStore } from "../state/AppState.tsx";
import type { Session } from "../runtime/session.ts";
import type { AppState } from "../state/AppStateStore.ts";

export interface RootProps {
  session: Session;
  initialState?: Partial<AppState>;
}

export const Root: React.FC<RootProps> = ({ session, initialState }) => {
  const store = useMemo(() => {
    return createAppStore({
      session,
      messages: [],
      inputValue: "",
      promptSuggestion: {
        text: null,
        shownAt: 0,
      },
      currentModel: session.config.model,
      isAssistantResponding: false,
      selector: null,
      ...initialState,
    });
  }, [session, initialState]);

  return (
    <AppStateProvider store={store}>
      <Box flexDirection="column" width="100%" height="100%">
        <REPL />
      </Box>
    </AppStateProvider>
  );
};
