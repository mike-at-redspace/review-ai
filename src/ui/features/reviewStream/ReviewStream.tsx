import React from "react";
import { Box, Text } from "ink";

interface ReviewStreamProps {
  rawText: string;
  isStreaming: boolean;
  maxHeight?: number;
}

export function ReviewStream({
  rawText,
  isStreaming,
  maxHeight,
}: ReviewStreamProps) {
  const borderColor = isStreaming ? "yellow" : "green";
  const lines = rawText.split("\n");
  const visibleLines =
    maxHeight && lines.length > maxHeight
      ? lines.slice(lines.length - maxHeight)
      : lines;

  return (
    <Box
      flexDirection="column"
      marginX={1}
      marginBottom={1}
      borderStyle="round"
      borderColor={borderColor}
      padding={1}
    >
      {rawText ? (
        <Box flexDirection="column">
          {visibleLines.map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
          {isStreaming && <Text color="yellow">_</Text>}
        </Box>
      ) : (
        <Text color="gray">Waiting for review...</Text>
      )}
    </Box>
  );
}
