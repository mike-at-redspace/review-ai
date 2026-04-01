import React, { useState, useCallback, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import {
  Header,
  ProgressBar,
  IssueSummaryBar,
  IssueList,
  Divider,
} from "@ui/layout";
import { FileSelection } from "@ui/features/fileSelection";
import { ReviewStream } from "@ui/features/reviewStream";
import { ChatLoop } from "@ui/features/chat";
import { useReviewContext } from "@ui/context/ReviewContext";
import { useTerminalSize } from "@ui/hooks/useTerminalSize";
import { parseReviewResponse, generatePrReviewMarkdown } from "@core/ai";
import { appendChunk, startStream, finishStream } from "@core/streamStore";
import type { ViewState, ChangedFile } from "@core/config";
import { MIN_TERMINAL_COLUMNS, MIN_TERMINAL_ROWS } from "@core/config";
import { writeFileSync } from "fs";

interface DashboardProps {
  gitFiles: ChangedFile[];
  version?: string;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export function Dashboard({
  gitFiles,
  version,
  onComplete,
  onError,
}: DashboardProps) {
  const { config, generator, session, updateSession } = useReviewContext();
  const [viewState, setViewState] = useState<ViewState>({
    type: "file-selection",
  });
  const { columns, rows } = useTerminalSize();
  const terminalTooSmall =
    columns < MIN_TERMINAL_COLUMNS || rows < MIN_TERMINAL_ROWS;
  const contentWidth = Math.max(columns - 4, 1);
  const contentHeight = Math.max(rows - 10, 5);

  useEffect(() => {
    return () => {
      void generator.stop();
    };
  }, [generator]);

  const handleFilesConfirmed = useCallback(
    async (selectedPaths: string[]) => {
      const selectedFiles = gitFiles.filter((f) =>
        selectedPaths.includes(f.path)
      );
      const combinedDiff = selectedFiles
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
          session.branch,
          undefined,
          (chunk: string) => {
            appendChunk(chunk);
          },
          (phase) => {
            setViewState({ type: "reviewing", phase });
          }
        );

        finishStream();
        const issues = parseReviewResponse(rawResponse);
        updateSession({ issues });
        setViewState({ type: "review-complete" });
      } catch (err) {
        finishStream();
        const message = err instanceof Error ? err.message : "Unknown error";
        setViewState({ type: "error", message });
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [gitFiles, config, generator, session.branch, updateSession, onError]
  );

  const handleDone = useCallback(() => {
    setViewState({ type: "generating-report" });
    try {
      const markdown = generatePrReviewMarkdown(session, config);
      writeFileSync(config.outputPath, markdown, "utf-8");
      setViewState({ type: "done", outputPath: config.outputPath });
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err) {
      setViewState({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to write report",
      });
    }
  }, [session, config, onComplete]);

  const handleStartChat = useCallback(() => {
    setViewState({ type: "chatting" });
  }, []);

  if (terminalTooSmall) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">
          Terminal too small. Please resize to at least {MIN_TERMINAL_COLUMNS}x
          {MIN_TERMINAL_ROWS}.
        </Text>
        <Text color="gray">Press Ctrl+C to exit.</Text>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor="green"
      padding={1}
      flexDirection="column"
      height={rows}
      overflow="hidden"
    >
      <Header
        branch={session.branch}
        version={version}
        maxWidth={contentWidth}
      />
      <Divider width={contentWidth} />

      {viewState.type === "file-selection" && (
        <FileSelection
          files={gitFiles}
          onConfirm={handleFilesConfirmed}
          maxHeight={contentHeight}
          maxWidth={contentWidth}
        />
      )}

      {viewState.type === "reviewing" && (
        <>
          <ReviewStream maxHeight={contentHeight} />
          <ProgressBar phase={viewState.phase} isGenerating={true} />
        </>
      )}

      {viewState.type === "review-complete" && (
        <Box flexDirection="column">
          <IssueSummaryBar issues={session.issues} />
          <IssueList
            issues={session.issues.filter((i) => !i.ignored)}
            maxHeight={Math.floor(contentHeight * 0.6)}
          />
          <Box paddingX={1} marginTop={1}>
            <Text color="cyan">
              Press Enter to start interactive review, or press D to generate
              report
            </Text>
          </Box>
          <ReviewCompleteInput onChat={handleStartChat} onDone={handleDone} />
        </Box>
      )}

      {viewState.type === "chatting" && (
        <ChatLoop
          onDone={handleDone}
          maxWidth={contentWidth}
          maxHeight={contentHeight}
        />
      )}

      {viewState.type === "generating-report" && (
        <Box paddingX={1} marginY={1}>
          <ProgressBar
            phase={undefined}
            isGenerating={false}
            status="Writing PR-REVIEW.md..."
          />
        </Box>
      )}

      {viewState.type === "done" && (
        <Box paddingX={1} marginY={1}>
          <Text color="green">Report saved to {viewState.outputPath}</Text>
        </Box>
      )}

      {viewState.type === "error" && (
        <Box paddingX={1} marginY={1}>
          <Text color="red">✕ {viewState.message}</Text>
        </Box>
      )}
    </Box>
  );
}

function ReviewCompleteInput({
  onChat,
  onDone,
}: {
  onChat: () => void;
  onDone: () => void;
}) {
  useInput((input, key) => {
    if (key.return) {
      onChat();
    }
    if (input === "d" || input === "D") {
      onDone();
    }
  });
  return (
    <Box paddingX={1}>
      <Text color="gray">Enter: chat | D: done</Text>
    </Box>
  );
}
