import React from "react";
import { Box, Text } from "ink";

interface DividerProps {
  title?: string;
  color?: string;
  width?: number;
}

export function Divider({ title, color = "gray", width }: DividerProps) {
  const totalWidth = width ?? 40;

  if (!title) {
    return (
      <Box paddingX={1}>
        <Text color={color}>{"─".repeat(Math.max(0, totalWidth - 2))}</Text>
      </Box>
    );
  }

  const label = ` ${title} `;
  const remaining = Math.max(0, totalWidth - 2 - label.length);
  const left = Math.floor(remaining / 2);
  const right = remaining - left;

  return (
    <Box paddingX={1}>
      <Text color={color}>
        {"─".repeat(left)}
        {label}
        {"─".repeat(right)}
      </Text>
    </Box>
  );
}
