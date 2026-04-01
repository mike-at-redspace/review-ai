import React, { useState, useCallback, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { Header, ProgressBar, IssueSummaryBar, IssueList } from "@ui/layout";
import { FileSelection } from "@ui/features/fileSelection";
import { ReviewStream } from "@ui/features/reviewStream";
import { ChatLoop } from "@ui/features/chat";
import { useReviewContext } from "@ui/context/ReviewContext";
import { useTerminalSize } from "@ui/hooks/useTerminalSize";
import { parseReviewResponse, generatePrReviewMarkdown } from "@core/ai";
import type { ViewState, ReviewProgressPhase, ChangedFile } from "@core/config";
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
  const [viewState, setViewState] = useState<ViewState>("file-selection");
  const [streamingText, setStreamingText] = useState("");
  const [phase, setPhase] = useState<ReviewProgressPhase>("session");
  const [error, setError] = useState<string | undefined>();
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

  useInput((input) => {
    if ((input === "c" && viewState === "file-selection") || input === "") {
      // Ctrl+C handled by process
    }
  });

  // File selection confirmed
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

      setViewState("reviewing");
      setStreamingText("");
      setPhase("session");
      setError(undefined);

      try {
        const rawResponse = await generator.review(
          combinedDiff,
          config,
          session.branch,
          undefined,
          (chunk: string) => {
            setStreamingText((prev) => prev + chunk);
          },
          (p: ReviewProgressPhase) => {
            setPhase(p);
          }
        );

        const issues = parseReviewResponse(rawResponse);
        updateSession({ issues });

        setViewState("review-complete");
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        setViewState("error");
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [gitFiles, config, generator, session.branch, updateSession, onError]
  );

  // Generate report and finish
  const handleDone = useCallback(() => {
    setViewState("generating-report");
    try {
      const markdown = generatePrReviewMarkdown(session, config);
      writeFileSync(config.outputPath, markdown, "utf-8");
      setViewState("done");
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to write report");
      setViewState("error");
    }
  }, [session, config, onComplete]);

  // Transition from review-complete to chatting
  const handleStartChat = useCallback(() => {
    setViewState("chatting");
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

      {viewState === "file-selection" && (
        <FileSelection
          files={gitFiles}
          onConfirm={handleFilesConfirmed}
          maxHeight={contentHeight}
        />
      )}

      {viewState === "reviewing" && (
        <>
          <ReviewStream
            rawText={streamingText}
            isStreaming={true}
            maxHeight={contentHeight}
          />
          <ProgressBar phase={phase} isGenerating={true} error={error} />
        </>
      )}

      {viewState === "review-complete" && (
        <Box flexDirection="column">
          <IssueSummaryBar issues={session.issues} />
          <IssueList
            issues={session.issues.filter((i) => !i.ignored)}
            maxHeight={Math.floor(contentHeight * 0.6)}
          />
          <Box paddingX={1} marginTop={1}>
            <Text color="cyan">
              Press Enter to start interactive review, or type &apos;done&apos;
              to generate report
            </Text>
          </Box>
          <ReviewCompleteInput onChat={handleStartChat} onDone={handleDone} />
        </Box>
      )}

      {viewState === "chatting" && (
        <ChatLoop
          onDone={handleDone}
          maxWidth={contentWidth}
          maxHeight={contentHeight}
        />
      )}

      {viewState === "generating-report" && (
        <Box paddingX={1} marginY={1}>
          <ProgressBar
            phase={undefined}
            isGenerating={false}
            status="Writing PR-REVIEW.md..."
          />
        </Box>
      )}

      {viewState === "done" && (
        <Box paddingX={1} marginY={1}>
          <Text color="green">Report saved to {config.outputPath}</Text>
        </Box>
      )}

      {viewState === "error" && error && (
        <Box paddingX={1} marginY={1}>
          <Text color="red">✕ {error}</Text>
        </Box>
      )}
    </Box>
  );
}

// Small helper component for review-complete input handling
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
