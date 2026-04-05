/**
 * AppState React Context & Hooks
 * Provides access to global state throughout the component tree
 */

import React, {
  useContext,
  useMemo,
  useCallback,
  useSyncExternalStore,
} from "react";
import { createAppStore, type AppStore } from "./store.ts";
import type { AppState } from "./AppStateStore.ts";

const AppStateContext = React.createContext<AppStore | null>(null);

export interface AppStateProviderProps {
  store: AppStore;
  children: React.ReactNode;
}

export function AppStateProvider({ store, children }: AppStateProviderProps) {
  return (
    <AppStateContext.Provider value={store}>
      {children}
    </AppStateContext.Provider>
  );
}

/**
 * Hook to access AppState (full state or with selector)
 * Subscribes to updates and re-renders when selected value changes
 */
export function useAppState(): AppState;
export function useAppState<T>(selector: (state: AppState) => T): T;
export function useAppState<T>(
  selector?: (state: AppState) => T,
): T | AppState {
  const store = useContext(AppStateContext);
  if (!store) {
    throw new Error("useAppState must be used within AppStateProvider");
  }

  return useSyncExternalStore(
    (listener) => store.subscribe(() => listener()),
    () => {
      const state = store.getState() as any;
      return selector ? selector(state) : state;
    },
  );
}

/**
 * Hook to update AppState
 * Returns a function that updates state based on updater function
 */
export function useSetAppState() {
  const store = useContext(AppStateContext);
  if (!store) {
    throw new Error("useSetAppState must be used within AppStateProvider");
  }

  return useCallback(
    (updater: (prev: AppState) => AppState) => {
      const state = store.getState() as any;
      const current = state as AppState;
      const next = updater(current);
      state.setState?.((_: any) => next);
    },
    [store],
  );
}

/**
 * Hook to get full store access (for advanced usage)
 */
export function useAppStore(): AppStore {
  const store = useContext(AppStateContext);
  if (!store) {
    throw new Error("useAppStore must be used within AppStateProvider");
  }
  return store;
}

/**
 * Export createAppStore for creating instances in Root component
 */
export { createAppStore } from "./store.ts";
