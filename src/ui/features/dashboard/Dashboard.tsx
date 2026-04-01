import React, { useCallback, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import {
  Divider,
  Header,
  IssueList,
  IssueSummaryBar,
  ProgressBar,
} from "@ui/layout";
import { FileSelection, ReviewStream, ChatLoop } from "@ui/features";
import { useReviewContext } from "@ui/context";
import { useTerminalSize, useReviewFlow, useReportWriter } from "@ui/hooks";
import {
  MIN_TERMINAL_COLUMNS,
  MIN_TERMINAL_ROWS,
  type ChangedFile,
} from "@core/config";

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
  const { columns, rows } = useTerminalSize();

  const { viewState, setViewState, handleFilesConfirmed } = useReviewFlow({
    gitFiles,
    config,
    generator,
    branch: session.branch,
    updateSession,
    onError,
  });

  const { handleDone } = useReportWriter({
    session,
    config,
    onComplete,
    setViewState,
  });

  const handleStartChat = useCallback(
    () => setViewState({ type: "chatting" }),
    [setViewState]
  );

  useEffect(() => () => void generator.stop(), [generator]);

  const tooSmall = columns < MIN_TERMINAL_COLUMNS || rows < MIN_TERMINAL_ROWS;
  const contentWidth = Math.max(columns - 4, 1);
  // Chrome: outer border(2) + outer padding(2) + header(3) + byline(1) + divider(1) + progress bar(2) + margin(1) = 12
  const contentHeight = Math.max(rows - 12, 5);

  if (tooSmall) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">
          Terminal too small. Resize to at least {MIN_TERMINAL_COLUMNS}x
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
          <ProgressBar
            phase={viewState.phase}
            model={generator.selectedModel}
            isGenerating
          />
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
    if (key.return) onChat();
    if (input.toLowerCase() === "d") onDone();
  });
  return (
    <Box paddingX={1}>
      <Text color="gray">Enter: chat | d: done</Text>
    </Box>
  );
}
