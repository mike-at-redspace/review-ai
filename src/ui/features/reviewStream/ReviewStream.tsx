import React from "react";
import { Box, Text } from "ink";
import { useStreamText, useIsStreaming } from "@core/streamStore";

interface ReviewStreamProps {
  maxHeight?: number;
}

export function ReviewStream({ maxHeight }: ReviewStreamProps) {
  const rawText = useStreamText();
  const isStreaming = useIsStreaming();
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
