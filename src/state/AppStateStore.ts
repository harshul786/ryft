/**
 * AppState Type Definition
 * Core state shape for the REPL application
 */

import type { Session } from "../runtime/session.ts";
import type { ModelOption } from "../types.ts";
import type { ToolCallEntry } from "../components/ToolCallPreview.tsx";

export type Message =
  | { role: "user" | "assistant"; content: string }
  | { role: "tool-calls"; content: ""; entries: ToolCallEntry[] };

// Re-export for convenience across the app
export type { ToolCallEntry } from "../components/ToolCallPreview.tsx";

export type PromptSuggestion = {
  text: string | null;
  shownAt: number;
};

export interface SelectOption<T = any> {
  label: string;
  value: T;
  description?: string;
}

export type SelectorState<T = any> = {
  type: "select";
  title: string;
  options: SelectOption<T>[];
  onSelect: (value: T) => void;
  onCancel?: () => void;
  initialFocusIndex?: number;
};

export type PrompterState = {
  type: "input";
  label: string;
  placeholder?: string;
  initialValue?: string;
  onSubmit: (value: string) => void;
  onCancel?: () => void;
};

export interface AppState {
  // Session
  session: Session;

  // Input & Messages
  messages: Message[];
  inputValue: string;

  // Suggestions
  promptSuggestion: PromptSuggestion;

  // Model & Status
  currentModel: ModelOption;
  isAssistantResponding: boolean;
  isSwitchingMode: boolean;

  // Selector Modal
  selector: SelectorState | null;

  // Text input prompt overlay (used by multi-step model picker)
  prompter: PrompterState | null;

  // Scroll state: how many messages from the bottom are hidden (0 = pinned to bottom)
  scrollOffset: number;
  // When true, scrollOffset resets to 0 on new messages (sticky bottom)
  isScrolledToBottom: boolean;
}

export const createInitialState = (session: Session): AppState => ({
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
});
