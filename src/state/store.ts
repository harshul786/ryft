/**
 * Zustand Store
 * Creates reactive state container for AppState
 */

import { create } from "zustand";
import type { AppState } from "./AppStateStore.ts";

type StoreState = AppState & {
  setState: (updater: (prev: AppState) => AppState) => void;
};

export type AppStore = any; // Zustand store type

export function createAppStore(initialState: AppState): AppStore {
  return create<StoreState>((set) => ({
    ...initialState,
    setState: (updater) => {
      set((state) => updater(state));
    },
  })) as any;
}
