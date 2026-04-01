import React from "react";
import { Text } from "ink";

interface BylineProps {
  items: string[];
  color?: string;
}

export function Byline({ items, color = "gray" }: BylineProps) {
  return <Text color={color}>{items.filter(Boolean).join(" · ")}</Text>;
}
