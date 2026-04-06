/**
 * AppState Type Definition
 * Core state shape for the REPL application
 */

import type { Session } from "../runtime/session.ts";
import type { ModelOption } from "../types.ts";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

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

  // Selector Modal
  selector: SelectorState | null;

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
  selector: null,
  scrollOffset: 0,
  isScrolledToBottom: true,
});
