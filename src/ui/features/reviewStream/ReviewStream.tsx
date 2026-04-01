import React from "react";
import { Box, Text } from "ink";
import {
  useActiveToolCall,
  useExploredFiles,
  useIsStreaming,
  useStreamText,
} from "@core/streamStore";

interface ReviewStreamProps {
  maxHeight?: number;
}

export function ReviewStream({ maxHeight }: ReviewStreamProps) {
  const rawText = useStreamText();
  const isStreaming = useIsStreaming();
  const toolCall = useActiveToolCall();
  const exploredFiles = useExploredFiles();

  // While exploring (no review text yet), show the accumulated file list.
  if (toolCall && !rawText) {
    return (
      <Box
        flexDirection="column"
        marginX={1}
        marginBottom={1}
        borderStyle="round"
        borderColor="cyan"
        padding={1}
      >
        <Text color="cyan" bold>
          Exploring dependencies ({exploredFiles.length} file
          {exploredFiles.length === 1 ? "" : "s"})
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {exploredFiles.map((file, i) => {
            const isLast = i === exploredFiles.length - 1;
            return (
              <Text key={i} color="gray">
                {isLast ? "  reading " : "  read    "}
                {file}
              </Text>
            );
          })}
        </Box>
      </Box>
    );
  }

  // Once streaming text arrives, show the review output.
  const lines = rawText.split("\n");
  const visible =
    maxHeight && lines.length > maxHeight ? lines.slice(-maxHeight) : lines;

  return (
    <Box
      flexDirection="column"
      marginX={1}
      marginBottom={1}
      borderStyle="round"
      borderColor={isStreaming ? "yellow" : "green"}
      padding={1}
    >
      {rawText ? (
        <Box flexDirection="column">
          {visible.map((line, i) => (
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
