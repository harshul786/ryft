import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "../ink.ts";
import { COLORS } from "./theme.ts";

export interface SelectOption<T> {
  label: string;
  value: T;
  description?: string;
}

interface SelectProps<T> {
  options: SelectOption<T>[];
  onSelect: (value: T) => void;
  onCancel?: () => void;
  initialFocusIndex?: number;
  label?: string;
}

export function Select<T>({
  options,
  onSelect,
  onCancel,
  initialFocusIndex = 0,
  label = "Select an option",
}: SelectProps<T>) {
  const [focusedIndex, setFocusedIndex] = useState(
    Math.min(initialFocusIndex, options.length - 1),
  );

  useInput((input, key) => {
    if (key.downArrow) {
      setFocusedIndex((prev) => (prev + 1) % options.length);
      return;
    }
    if (key.upArrow) {
      setFocusedIndex((prev) => (prev - 1 + options.length) % options.length);
      return;
    }
    if (key.return) {
      onSelect(options[focusedIndex].value);
      return;
    }
    if (key.escape || (key.ctrl && input === "c")) {
      onCancel?.();
      return;
    }
    if (!key.ctrl && !key.meta) {
      const num = parseInt(input, 10);
      if (!isNaN(num) && num >= 1 && num <= options.length) {
        setFocusedIndex(num - 1);
        return;
      }
    }
  });

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
        <Text color={COLORS.dim}>
          {" "}
          [{focusedIndex + 1}/{options.length}]
        </Text>
      </Box>

      {/* Options list */}
      {options.map((option, idx) => {
        const isFocused = idx === focusedIndex;
        return (
          <Box key={idx} marginBottom={0}>
            <Text
              color={isFocused ? COLORS.primaryBright : COLORS.dim}
              bold={isFocused}
            >
              {isFocused ? " ▶ " : "   "}
              <Text color={isFocused ? COLORS.primaryBright : COLORS.hint}>
                {String(idx + 1).padStart(2, " ")}.{" "}
              </Text>
              {option.label}
            </Text>
            {option.description && (
              <Text color={COLORS.dim} dimColor>
                {"  "}
                {option.description}
              </Text>
            )}
          </Box>
        );
      })}

      {/* Footer hint */}
      <Box marginTop={1}>
        <Text color={COLORS.dim} dimColor>
          {" "}
          ↑↓ navigate · enter select · esc cancel · 1–{options.length} quick
          pick
        </Text>
      </Box>
    </Box>
  );
}
