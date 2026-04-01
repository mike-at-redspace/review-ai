import { useCallback, useState } from "react";
import type {
  ChangedFile,
  ReviewConfig,
  ReviewSession,
  ViewState,
} from "@core/config";
import { parseReviewResponse, parseToolFilePath } from "@core/ai";
import type { ReviewGenerator } from "@core/ai";
import {
  appendChunk,
  clearToolCall,
  finishStream,
  setToolCall,
  startStream,
} from "@core/streamStore";

interface UseReviewFlowOptions {
  gitFiles: ChangedFile[];
  config: ReviewConfig;
  generator: ReviewGenerator;
  branch: string;
  updateSession: (patch: Partial<ReviewSession>) => void;
  onError: (error: Error) => void;
}

export function useReviewFlow({
  gitFiles,
  config,
  generator,
  branch,
  updateSession,
  onError,
}: UseReviewFlowOptions) {
  const [viewState, setViewState] = useState<ViewState>({
    type: "file-selection",
  });

  const handleFilesConfirmed = useCallback(
    async (selectedPaths: string[]) => {
      const selected = gitFiles.filter((f) => selectedPaths.includes(f.path));
      const combinedDiff = selected
        .filter((f) => !f.binary && f.diff)
        .map((f) => f.diff)
        .join("\n");

      updateSession({
        selectedFiles: selectedPaths,
        diff: combinedDiff,
        startedAt: Date.now(),
      });

      setViewState({ type: "reviewing", phase: "session" });
      startStream();

      try {
        const rawResponse = await generator.review(
          combinedDiff,
          config,
          branch,
          undefined,
          {
            onChunk: (chunk) => appendChunk(chunk),
            onProgress: (phase) => {
              if (phase === "streaming") clearToolCall();
              setViewState({ type: "reviewing", phase });
            },
            onToolCall: (toolName, args) =>
              setToolCall(toolName, parseToolFilePath(args) ?? toolName),
          }
        );

        finishStream();
        updateSession({ issues: parseReviewResponse(rawResponse) });
        setViewState({ type: "review-complete" });
      } catch (err) {
        finishStream();
        const message = err instanceof Error ? err.message : "Unknown error";
        setViewState({ type: "error", message });
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [gitFiles, config, generator, branch, updateSession, onError]
  );

  return { viewState, setViewState, handleFilesConfirmed };
}
