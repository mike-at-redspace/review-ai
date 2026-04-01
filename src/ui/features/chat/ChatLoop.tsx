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
import type { ReviewProgressPhase } from "@core/config";

interface ChatLoopProps {
  onDone: () => void;
  maxWidth?: number;
  maxHeight?: number;
}

const EXPAND_REGEX = /^(expand|detail)\s+#?(\d+)$/i;
const IGNORE_REGEX = /^ignore\s+#?(\d+)$/i;
const FOCUS_REGEX = /^focus\s+(.+)$/i;
const REWRITE_REGEX = /^rewrite\s+#?(\d+)$/i;
const DONE_REGEX = /^done$/i;

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

  const handleInput = useCallback(
    (input: string) => {
      // Done
      if (DONE_REGEX.test(input)) {
        onDone();
        return;
      }

      // Ignore
      const ignoreMatch = input.match(IGNORE_REGEX);
      if (ignoreMatch) {
        const id = parseInt(ignoreMatch[2], 10);
        const issue = session.issues.find((i) => i.id === id);
        if (issue) {
          ignoreIssue(id);
          addChatMessage({
            role: "user",
            content: `ignore #${id}`,
          });
        } else {
          setError(
            `Issue #${id} not found. Available: #${session.issues.map((i) => i.id).join(", #")}`
          );
        }
        return;
      }

      addChatMessage({ role: "user", content: input });

      // Expand
      const expandMatch = input.match(EXPAND_REGEX);
      if (expandMatch) {
        const id = parseInt(expandMatch[2], 10);
        const issue = session.issues.find((i) => i.id === id);
        if (issue) {
          sendToAi(buildExpandPrompt(issue));
        } else {
          setError(`Issue #${id} not found.`);
        }
        return;
      }

      // Focus
      const focusMatch = input.match(FOCUS_REGEX);
      if (focusMatch) {
        sendToAi(buildFocusPrompt(focusMatch[1]));
        return;
      }

      // Rewrite
      const rewriteMatch = input.match(REWRITE_REGEX);
      if (rewriteMatch) {
        const id = parseInt(rewriteMatch[2], 10);
        const issue = session.issues.find((i) => i.id === id);
        if (issue) {
          sendToAi(buildRewritePrompt(issue));
        } else {
          setError(`Issue #${id} not found.`);
        }
        return;
      }

      // Freeform
      sendToAi(input);
    },
    [onDone, session.issues, ignoreIssue, addChatMessage, sendToAi]
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
