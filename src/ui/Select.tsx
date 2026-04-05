import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "../ink.ts";

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
    // Arrow down
    if (key.downArrow) {
      setFocusedIndex((prev) => (prev + 1) % options.length);
      return;
    }

    // Arrow up
    if (key.upArrow) {
      setFocusedIndex((prev) => (prev - 1 + options.length) % options.length);
      return;
    }

    // Enter - select
    if (key.return) {
      onSelect(options[focusedIndex].value);
      return;
    }

    // Escape or Ctrl+C - cancel
    if (key.escape || (key.ctrl && input === "c")) {
      onCancel?.();
      return;
    }

    // Number keys 1-9 for quick selection
    if (!key.ctrl && !key.meta) {
      const num = parseInt(input, 10);
      if (!isNaN(num) && num >= 1 && num <= options.length) {
        setFocusedIndex(num - 1);
        return;
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>{label}</Text>
      </Box>

      {options.map((option, idx) => (
        <Box key={idx} marginBottom={0}>
          <Text
            color={idx === focusedIndex ? "cyan" : "gray"}
            backgroundColor={idx === focusedIndex ? "gray" : undefined}
            bold={idx === focusedIndex}
          >
            {idx === focusedIndex ? "▶ " : "  "}
            {String(idx + 1).padStart(2, " ")}. {option.label}
          </Text>
          {option.description && (
            <Text color="gray" dimColor>
              {" "}
              ({option.description})
            </Text>
          )}
        </Box>
      ))}

      <Box marginTop={1}>
        <Text italic color="gray" dimColor>
          ↑↓ Navigate • ENTER Select • ESC Cancel • 1-{options.length} Quick
          pick
        </Text>
      </Box>
    </Box>
  );
}
