/**
 * Ink Framework Wrapper — uses the claude-cli ink fork for ScrollBox, custom
 * reconciler, and proper context wiring. cli.ts must call the fork's render.
 */

// Core components from the fork
export { default as Box } from "./ink-fork/components/Box.js";
export { default as Text } from "./ink-fork/components/Text.js";
export { default as Spacer } from "./ink-fork/components/Spacer.js";

// ScrollBox — scroll container with sticky-scroll support
export {
  default as ScrollBox,
  type ScrollBoxHandle,
  type ScrollBoxProps,
} from "./ink-fork/components/ScrollBox.js";

// Hooks from the fork (require fork's App context providers)
export { default as useInput } from "./ink-fork/hooks/use-input.js";
export { default as useStdin } from "./ink-fork/hooks/use-stdin.js";
export { default as useApp } from "./ink-fork/hooks/use-app.js";
export { useTerminalViewport as useStdout } from "./ink-fork/hooks/use-terminal-viewport.js";
export { useTerminalFocus } from "./ink-fork/hooks/use-terminal-focus.js";

// render + types from the fork's root (wrappedRender is async)
export {
  default as render,
  renderSync,
  type RenderOptions,
  type Instance,
} from "./ink-fork/root.js";

// DOMElement type
export type { DOMElement } from "./ink-fork/dom.js";

// Re-export React for convenience
export { default as React } from "react";
