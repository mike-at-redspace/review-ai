import React from "react";
import { Box, Text } from "ink";
import type { ReviewProgressPhase } from "@core/config";
import { PROGRESS_SPINNER_LABELS } from "@core/config";
import { useAnimationFrame } from "@ui/hooks/useClock";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;

function AnimatedSpinner() {
  const time = useAnimationFrame(SPINNER_INTERVAL_MS);
  const frame = Math.floor(time / SPINNER_INTERVAL_MS) % SPINNER_FRAMES.length;
  return <Text color="yellow">{SPINNER_FRAMES[frame]}</Text>;
}

interface ProgressBarProps {
  phase?: ReviewProgressPhase;
  isGenerating: boolean;
  error?: string;
  status?: string;
}

export function ProgressBar({
  phase,
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
        <Text color="gray"> {PROGRESS_SPINNER_LABELS[phase]}</Text>
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
