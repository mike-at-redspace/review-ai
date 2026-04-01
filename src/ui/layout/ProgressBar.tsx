import React from "react";
import { Box, Text } from "ink";
import {
  PROGRESS_SPINNER_LABELS,
  type ReviewProgressPhase,
} from "@core/config";
import { useActiveToolCall } from "@core/streamStore";
import { useAnimationFrame } from "@ui/hooks";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;

const PHASES_WITH_MODEL: ReviewProgressPhase[] = [
  "session",
  "sending",
  "streaming",
  "exploring",
];

function spinnerLabel(
  phase: ReviewProgressPhase,
  model?: string | null,
  toolCall?: { toolName: string; filePath?: string; callNumber: number }
): string {
  if (phase === "exploring" && toolCall) {
    const target = toolCall.filePath ?? toolCall.toolName;
    return `Reading ${target} (file ${toolCall.callNumber})...`;
  }
  const base = PROGRESS_SPINNER_LABELS[phase] ?? phase;
  if (!model?.trim() || !PHASES_WITH_MODEL.includes(phase)) {
    return base;
  }
  return base.replace(/\.\.\.$/, ` (${model})...`);
}

function AnimatedSpinner() {
  const time = useAnimationFrame(SPINNER_INTERVAL_MS);
  const frame = Math.floor(time / SPINNER_INTERVAL_MS) % SPINNER_FRAMES.length;
  return <Text color="yellow">{SPINNER_FRAMES[frame]}</Text>;
}

interface ProgressBarProps {
  phase?: ReviewProgressPhase;
  /** Copilot model id (shown during session / send / stream). */
  model?: string | null;
  isGenerating: boolean;
  error?: string;
  status?: string;
}

export function ProgressBar({
  phase,
  model,
  isGenerating,
  error,
  status,
}: ProgressBarProps) {
  const toolCall = useActiveToolCall();

  if (error) {
    return (
      <Box paddingX={1} marginTop={1}>
        <Text color="red">✕ {error}</Text>
      </Box>
    );
  }

  if (isGenerating && phase) {
    const label = spinnerLabel(phase, model, toolCall);
    return (
      <Box paddingX={1} marginTop={1}>
        <AnimatedSpinner />
        <Text color={phase === "exploring" ? "cyan" : "gray"}> {label}</Text>
      </Box>
    );
  }

  if (status) {
    return (
      <Box paddingX={1} marginTop={1}>
        <Text color="gray">{status}</Text>
      </Box>
    );
  }

  return null;
}
