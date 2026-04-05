/**
 * Ink Framework Wrapper
 * Single export point for all Ink terminal UI components and hooks
 * Makes it easy to swap or patch Ink in the future
 */

// Re-export all Ink components and hooks
export {
  Box,
  Text,
  Spacer,
  type DOMElement,
  type Instance,
  useInput,
  useStdin,
  useStdout,
  useFocus,
  useFocusManager,
  useApp,
  render,
  type RenderOptions,
} from "ink";

// Re-export React for convenience
export { default as React } from "react";
