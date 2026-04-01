import React from "react";
import { Box, Text } from "ink";

interface StreamingResponseProps {
  text: string;
  maxHeight?: number;
}

export function StreamingResponse({ text, maxHeight }: StreamingResponseProps) {
  const lines = text.split("\n");
  const visibleLines =
    maxHeight && lines.length > maxHeight
      ? lines.slice(lines.length - maxHeight)
      : lines;

  return (
    <Box
      flexDirection="column"
      marginX={1}
      borderStyle="round"
      borderColor="yellow"
      padding={1}
    >
      {visibleLines.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
      <Text color="yellow">_</Text>
    </Box>
  );
}
