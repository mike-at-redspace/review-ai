import React, { useState, useCallback } from "react";
import { Box, Text } from "ink";
import {
  ChatInput,
  ChatMessage,
  StreamingResponse,
  IssueSummaryBar,
  IssueList,
} from "@ui/layout";
import { useReviewContext } from "@ui/context/ReviewContext";
import {
  buildExpandPrompt,
  buildFocusPrompt,
  buildRewritePrompt,
  parseReviewResponse,
} from "@core/ai";
import type { ChatCommand, ReviewProgressPhase } from "@core/config";

interface ChatLoopProps {
  onDone: () => void;
  maxWidth?: number;
  maxHeight?: number;
}

export function parseChatCommand(input: string): ChatCommand {
  const trimmed = input.trim();

  if (/^done$/i.test(trimmed)) {
    return { type: "done" };
  }

  const expandMatch = trimmed.match(/^(?:expand|detail)\s+#?(\d+)$/i);
  if (expandMatch) {
    return { type: "expand", issueId: parseInt(expandMatch[1], 10) };
  }

  const ignoreMatch = trimmed.match(/^ignore\s+#?(\d+)$/i);
  if (ignoreMatch) {
    return { type: "ignore", issueId: parseInt(ignoreMatch[1], 10) };
  }

  const focusMatch = trimmed.match(/^focus\s+(.+)$/i);
  if (focusMatch) {
    return { type: "focus", area: focusMatch[1] };
  }

  const rewriteMatch = trimmed.match(/^rewrite\s+#?(\d+)$/i);
  if (rewriteMatch) {
    return { type: "rewrite", issueId: parseInt(rewriteMatch[1], 10) };
  }

  return { type: "freeform", text: trimmed };
}

export function ChatLoop({ onDone, maxWidth, maxHeight }: ChatLoopProps) {
  const { session, generator, addChatMessage, ignoreIssue, updateSession } =
    useReviewContext();
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const sendToAi = useCallback(
    async (prompt: string) => {
      setStreamingText("");
      setIsStreaming(true);
      setError(undefined);

      try {
        const rawResponse = await generator.followUp(
          prompt,
          (chunk: string) => {
            setStreamingText((prev) => prev + chunk);
          },
          (_phase: ReviewProgressPhase) => {}
        );

        addChatMessage({ role: "assistant", content: rawResponse });

        // Try to parse any new issues from the response
        const newIssues = parseReviewResponse(rawResponse);
        if (
          newIssues.length > 0 &&
          !(newIssues.length === 1 && newIssues[0].title === "Review Summary")
        ) {
          const existingIds = new Set(session.issues.map((i) => i.title));
          const truly = newIssues.filter((i) => !existingIds.has(i.title));
          if (truly.length > 0) {
            const maxId = session.issues.reduce(
              (max, i) => Math.max(max, i.id),
              0
            );
            const withIds = truly.map((issue, idx) => ({
              ...issue,
              id: maxId + idx + 1,
            }));
            updateSession({
              issues: [...session.issues, ...withIds],
            });
          }
        }

        setStreamingText("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setStreamingText("");
      } finally {
        setIsStreaming(false);
      }
    },
    [generator, addChatMessage, session.issues, updateSession]
  );

  const findIssue = useCallback(
    (id: number) => session.issues.find((i) => i.id === id),
    [session.issues]
  );

  const handleInput = useCallback(
    (input: string) => {
      const command = parseChatCommand(input);

      switch (command.type) {
        case "done":
          onDone();
          return;

        case "ignore": {
          const issue = findIssue(command.issueId);
          if (issue) {
            ignoreIssue(command.issueId);
            addChatMessage({
              role: "user",
              content: `ignore #${command.issueId}`,
            });
          } else {
            setError(
              `Issue #${command.issueId} not found. Available: #${session.issues.map((i) => i.id).join(", #")}`
            );
          }
          return;
        }

        case "expand": {
          addChatMessage({ role: "user", content: input });
          const issue = findIssue(command.issueId);
          if (issue) {
            sendToAi(buildExpandPrompt(issue));
          } else {
            setError(`Issue #${command.issueId} not found.`);
          }
          return;
        }

        case "focus":
          addChatMessage({ role: "user", content: input });
          sendToAi(buildFocusPrompt(command.area));
          return;

        case "rewrite": {
          addChatMessage({ role: "user", content: input });
          const issue = findIssue(command.issueId);
          if (issue) {
            sendToAi(buildRewritePrompt(issue));
          } else {
            setError(`Issue #${command.issueId} not found.`);
          }
          return;
        }

        case "freeform":
          addChatMessage({ role: "user", content: input });
          sendToAi(command.text);
          return;
      }
    },
    [onDone, findIssue, session.issues, ignoreIssue, addChatMessage, sendToAi]
  );

  const recentMessages = session.chatHistory.slice(-6);
  const contentHeight = maxHeight ? Math.floor(maxHeight * 0.3) : undefined;

  return (
    <Box flexDirection="column">
      <IssueSummaryBar issues={session.issues} />
      <IssueList
        issues={session.issues.filter((i) => !i.ignored)}
        maxHeight={maxHeight ? Math.floor(maxHeight * 0.3) : undefined}
      />

      {recentMessages.length > 0 && (
        <Box
          flexDirection="column"
          marginX={1}
          borderStyle="single"
          borderColor="gray"
          padding={1}
          height={contentHeight}
        >
          {recentMessages.map((msg, i) => (
            <ChatMessage key={i} message={msg} maxWidth={maxWidth} />
          ))}
        </Box>
      )}

      {isStreaming && streamingText && (
        <StreamingResponse text={streamingText} maxHeight={8} />
      )}

      {error && (
        <Box paddingX={1}>
          <Text color="red">✕ {error}</Text>
        </Box>
      )}

      <ChatInput
        onSubmit={handleInput}
        placeholder="expand #N | ignore #N | focus <area> | rewrite #N | done"
        disabled={isStreaming}
      />

      <Box paddingX={1}>
        <Text color="gray">
          Type &apos;done&apos; to generate PR-REVIEW.md | Ctrl+C to cancel
        </Text>
      </Box>
    </Box>
  );
}
