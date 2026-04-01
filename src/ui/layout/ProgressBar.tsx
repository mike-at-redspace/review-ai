import React from "react";
import { Box, Text } from "ink";
import {
  PROGRESS_SPINNER_LABELS,
  type ReviewProgressPhase,
} from "@core/config";
import { useAnimationFrame } from "@ui/hooks";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;

const PHASES_WITH_MODEL: ReviewProgressPhase[] = [
  "session",
  "sending",
  "streaming",
];

function spinnerLabel(
  phase: ReviewProgressPhase,
  model?: string | null
): string {
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
  if (error) {
    return (
      <Box paddingX={1} marginTop={1}>
        <Text color="red">✕ {error}</Text>
      </Box>
    );
  }

  if (isGenerating && phase) {
    return (
      <Box paddingX={1} marginTop={1}>
        <AnimatedSpinner />
        <Text color="gray"> {spinnerLabel(phase, model)}</Text>
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
