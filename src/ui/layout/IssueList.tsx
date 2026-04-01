import React from "react";
import { Box, Text } from "ink";
import type { ReviewIssue } from "@core/config";
import { IssueCard } from "./IssueCard.js";

interface IssueListProps {
  issues: ReviewIssue[];
  maxHeight?: number;
}

export function IssueList({ issues, maxHeight }: IssueListProps) {
  const visibleIssues =
    maxHeight && issues.length > maxHeight
      ? issues.slice(0, maxHeight)
      : issues;
  const hidden = issues.length - visibleIssues.length;

  if (issues.length === 0) {
    return (
      <Box paddingX={1} marginY={1}>
        <Text color="green">No issues found. Code looks good!</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginY={1}>
      {visibleIssues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
      {hidden > 0 && (
        <Box paddingLeft={2}>
          <Text color="gray">
            ... and {hidden} more issue{hidden !== 1 ? "s" : ""}
          </Text>
        </Box>
      )}
    </Box>
  );
}
