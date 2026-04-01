import React from "react";
import { Box, Text } from "ink";
import type { ReviewIssue } from "@core/config";
import { SeverityBadge } from "./SeverityBadge.js";

interface IssueCardProps {
  issue: ReviewIssue;
  isSelected?: boolean;
}

export function IssueCard({ issue, isSelected }: IssueCardProps) {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box gap={1}>
        <Text color={isSelected ? "cyan" : "white"}>
          {isSelected ? ">" : " "} #{issue.id}
        </Text>
        <SeverityBadge severity={issue.severity} />
        <Text color="white" bold>
          {issue.category}:
        </Text>
        <Text>{issue.title}</Text>
      </Box>
      <Box paddingLeft={4}>
        <Text color="gray">
          {issue.file}
          {issue.lineRange
            ? ` (lines ${issue.lineRange.start}${issue.lineRange.end ? `-${issue.lineRange.end}` : ""})`
            : ""}
        </Text>
      </Box>
    </Box>
  );
}
