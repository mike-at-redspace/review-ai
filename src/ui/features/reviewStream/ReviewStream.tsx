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
  const isExploring = toolCall !== undefined;
  const borderColor = isStreaming ? "yellow" : "green";

  // While exploring (no review text yet), show the file list.
  // Once streaming text arrives, show the review output instead.
  if (isExploring && !rawText) {
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
          {exploredFiles.length !== 1 ? "s" : ""})
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {exploredFiles.map((file, i) => (
            <Text key={i} color="gray">
              {i === exploredFiles.length - 1 ? "  reading " : "  read    "}
              {file}
            </Text>
          ))}
        </Box>
      </Box>
    );
  }

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
