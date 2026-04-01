import React from "react";
import { Text } from "ink";

export type StatusType = "success" | "error" | "warning" | "info" | "pending";

const STATUS_MAP: Record<StatusType, { icon: string; color: string }> = {
  success: { icon: "✓", color: "green" },
  error: { icon: "✕", color: "red" },
  warning: { icon: "⚠", color: "yellow" },
  info: { icon: "ℹ", color: "blue" },
  pending: { icon: "●", color: "gray" },
};

interface StatusIconProps {
  status: StatusType;
}

export function StatusIcon({ status }: StatusIconProps) {
  const { icon, color } = STATUS_MAP[status];
  return <Text color={color}>{icon}</Text>;
}
