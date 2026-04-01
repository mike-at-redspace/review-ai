import React from "react";
import { Box, Text } from "ink";
import type { ReviewIssue, Severity } from "@core/config";
import { SEVERITY_COLORS } from "@core/config";
import { StatusIcon } from "./StatusIcon.js";
import type { StatusType } from "./StatusIcon.js";

const SEVERITY_STATUS_MAP: Record<Severity, StatusType> = {
  critical: "error",
  warning: "warning",
  info: "info",
  nitpick: "pending",
};

interface IssueSummaryBarProps {
  issues: ReviewIssue[];
}

export function IssueSummaryBar({ issues }: IssueSummaryBarProps) {
  const activeIssues = issues.filter((i) => !i.ignored);
  const counts: Record<Severity, number> = {
    critical: 0,
    warning: 0,
    info: 0,
    nitpick: 0,
  };
  for (const issue of activeIssues) {
    counts[issue.severity]++;
  }

  const parts: React.ReactElement[] = [];
  for (const sev of ["critical", "warning", "info", "nitpick"] as Severity[]) {
    if (counts[sev] > 0) {
      parts.push(
        <Box key={sev} gap={1}>
          <StatusIcon status={SEVERITY_STATUS_MAP[sev]} />
          <Text color={SEVERITY_COLORS[sev]}>
            {counts[sev]} {sev}
          </Text>
        </Box>
      );
    }
  }

  if (parts.length === 0) {
    return (
      <Box paddingX={1}>
        <StatusIcon status="success" />
        <Text color="green"> No issues found</Text>
      </Box>
    );
  }

  return (
    <Box paddingX={1} gap={2}>
      <Text bold>Issues:</Text>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 && <Text color="gray"> | </Text>}
        </React.Fragment>
      ))}
    </Box>
  );
}
