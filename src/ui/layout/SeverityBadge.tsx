import React from "react";
import { Text } from "ink";
import type { Severity } from "@core/config";
import { SEVERITY_COLORS } from "@core/config";

interface SeverityBadgeProps {
  severity: Severity;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <Text color={SEVERITY_COLORS[severity]} bold>
      [{severity.toUpperCase()}]
    </Text>
  );
}
