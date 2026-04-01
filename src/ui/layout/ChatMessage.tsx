import React from "react";
import { Box, Text } from "ink";
import type { ChatMessage as ChatMessageType } from "@core/config";

interface ChatMessageProps {
  message: ChatMessageType;
  maxWidth?: number;
}

export function ChatMessage({ message, maxWidth }: ChatMessageProps) {
  const isUser = message.role === "user";
  const content =
    maxWidth && message.content.length > maxWidth
      ? message.content.slice(0, maxWidth - 3) + "..."
      : message.content;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color={isUser ? "cyan" : "white"} bold>
        {isUser ? "You" : "Reviewer"}:
      </Text>
      <Box paddingLeft={2}>
        <Text>{content}</Text>
      </Box>
    </Box>
  );
}
