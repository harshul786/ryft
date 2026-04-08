import React, { useState } from "react";
import { Box, Text, useInput } from "../ink.ts";
import { COLORS } from "./theme.ts";

interface TextInputProps {
  label: string;
  placeholder?: string;
  initialValue?: string;
  onSubmit: (value: string) => void;
  onCancel?: () => void;
}

/**
 * Single-line freeform text entry overlay.
 * Modelled on Select.tsx — same border/header style, same Ink useInput pattern.
 *
 * Keys:
 *   Enter       → submit current value (empty submits empty string)
 *   Esc         → cancel
 *   Backspace   → delete last character
 *   Ctrl+U      → clear entire line
 *   Printable char → append to value
 */
export function TextInput({
  label,
  placeholder = "",
  initialValue = "",
  onSubmit,
  onCancel,
}: TextInputProps) {
  const [value, setValue] = useState(initialValue);

  useInput((input, key) => {
    if (key.return) {
      onSubmit(value);
      return;
    }
    if (key.escape || (key.ctrl && input === "c")) {
      onCancel?.();
      return;
    }
    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
      return;
    }
    if (key.ctrl && input === "u") {
      setValue("");
      return;
    }
    // Append printable characters only (ignore pure modifier combos)
    if (!key.ctrl && !key.meta && !key.escape && input.length > 0) {
      setValue((prev) => prev + input);
    }
  });

  const displayValue = value.length > 0 ? value : "";
  const showPlaceholder = value.length === 0 && placeholder.length > 0;

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box
        marginBottom={1}
        borderStyle="round"
        borderColor={COLORS.border}
        paddingX={1}
      >
        <Text bold color={COLORS.primary}>
          {" "}
          {label}{" "}
        </Text>
      </Box>

      {/* Input line */}
      <Box>
        <Text color={COLORS.dim}>{" ▶ "}</Text>
        {showPlaceholder ? (
          <Text color={COLORS.hint} dimColor>
            {placeholder}
          </Text>
        ) : (
          <Text color={COLORS.primaryBright}>{displayValue}</Text>
        )}
        {/* Cursor block */}
        <Text backgroundColor="blue" color="white">
          {" "}
        </Text>
      </Box>

      {/* Footer hint */}
      <Box marginTop={1}>
        <Text color={COLORS.dim} dimColor>
          {" "}
          enter confirm · esc cancel · ctrl+u clear
        </Text>
      </Box>
    </Box>
  );
}
