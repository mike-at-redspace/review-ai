import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface ChatInputProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({
  onSubmit,
  placeholder = "Type a message...",
  disabled = false,
}: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (input: string) => {
    const trimmed = input.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setValue("");
    }
  };

  return (
    <Box paddingX={1} marginTop={1}>
      <Text color="cyan" bold>
        {">"}{" "}
      </Text>
      {disabled ? (
        <Text color="gray">{placeholder}</Text>
      ) : (
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={placeholder}
        />
      )}
    </Box>
  );
}
