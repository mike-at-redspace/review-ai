import React, { useState, useCallback, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import type { ChangedFile } from "@core/config";

interface FileSelectionProps {
  files: ChangedFile[];
  onConfirm: (selectedPaths: string[]) => void;
  maxHeight: number;
}

const STATUS_COLORS: Record<string, string> = {
  added: "green",
  modified: "yellow",
  deleted: "red",
  renamed: "cyan",
};

const STATUS_LABELS: Record<string, string> = {
  added: "new",
  modified: "mod",
  deleted: "del",
  renamed: "ren",
};

// Title line + footer controls line + margins
const CHROME_LINES = 4;
const MIN_VISIBLE = 5;

export function FileSelection({
  files,
  onConfirm,
  maxHeight,
}: FileSelectionProps) {
  const reviewableFiles = files.filter((f) => !f.binary);
  const binaryFiles = files.filter((f) => f.binary);

  const [selected, setSelected] = useState<Set<string>>(
    new Set(reviewableFiles.map((f) => f.path))
  );
  const [cursor, setCursor] = useState(0);

  const binaryOverhead = binaryFiles.length > 0 ? binaryFiles.length + 2 : 0;
  const maxVisible = Math.max(
    MIN_VISIBLE,
    maxHeight - CHROME_LINES - binaryOverhead
  );
  const needsScroll = reviewableFiles.length > maxVisible;

  // Compute the visible window, keeping cursor in view
  const { windowStart, windowEnd } = useMemo(() => {
    if (!needsScroll) {
      return { windowStart: 0, windowEnd: reviewableFiles.length };
    }

    const padding = Math.min(2, Math.floor(maxVisible / 4));
    let start = 0;

    if (cursor < start + padding) {
      start = Math.max(0, cursor - padding);
    } else if (cursor >= start + maxVisible - padding) {
      start = Math.min(
        reviewableFiles.length - maxVisible,
        cursor - maxVisible + padding + 1
      );
    }
    start = Math.max(0, start);
    const end = Math.min(reviewableFiles.length, start + maxVisible);

    return { windowStart: start, windowEnd: end };
  }, [cursor, maxVisible, needsScroll, reviewableFiles.length]);

  const visibleFiles = reviewableFiles.slice(windowStart, windowEnd);

  const toggleFile = useCallback((path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === reviewableFiles.length) {
        return new Set();
      }
      return new Set(reviewableFiles.map((f) => f.path));
    });
  }, [reviewableFiles]);

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((prev) => (prev > 0 ? prev - 1 : reviewableFiles.length - 1));
    } else if (key.downArrow) {
      setCursor((prev) => (prev < reviewableFiles.length - 1 ? prev + 1 : 0));
    } else if (input === " ") {
      const file = reviewableFiles[cursor];
      if (file) toggleFile(file.path);
    } else if (input === "a" || input === "A") {
      toggleAll();
    } else if (key.return) {
      const selectedPaths = Array.from(selected);
      if (selectedPaths.length > 0) {
        onConfirm(selectedPaths);
      }
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} marginBottom={1}>
        <Text bold>
          Select files to review ({selected.size}/{reviewableFiles.length})
        </Text>
        {needsScroll && (
          <Text color="gray">
            {" "}
            [{windowStart + 1}-{windowEnd} of {reviewableFiles.length}]
          </Text>
        )}
      </Box>

      {needsScroll && windowStart > 0 && (
        <Box paddingX={1}>
          <Text color="gray">
            {"  "}↑ {windowStart} more above
          </Text>
        </Box>
      )}

      {visibleFiles.map((file, visibleIndex) => {
        const actualIndex = windowStart + visibleIndex;
        const isSelected = selected.has(file.path);
        const isCursor = actualIndex === cursor;
        return (
          <Box key={file.path} paddingX={1}>
            <Text color={isCursor ? "cyan" : "white"}>
              {isCursor ? ">" : " "}{" "}
            </Text>
            <Text color={isSelected ? "green" : "gray"}>
              {isSelected ? "[x]" : "[ ]"}{" "}
            </Text>
            <Text color={STATUS_COLORS[file.status] ?? "white"}>
              [{STATUS_LABELS[file.status] ?? file.status}]{" "}
            </Text>
            <Text color={file.staged ? "cyan" : "white"}>{file.path}</Text>
            {file.staged && <Text color="gray"> (staged)</Text>}
          </Box>
        );
      })}

      {needsScroll && windowEnd < reviewableFiles.length && (
        <Box paddingX={1}>
          <Text color="gray">
            {"  "}↓ {reviewableFiles.length - windowEnd} more below
          </Text>
        </Box>
      )}

      {binaryFiles.length > 0 && (
        <Box flexDirection="column" paddingX={1} marginTop={1}>
          <Text color="gray" dimColor>
            Binary files (skipped):
          </Text>
          {binaryFiles.map((file) => (
            <Box key={file.path} paddingX={2}>
              <Text color="gray" dimColor>
                {file.path}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      <Box paddingX={1} marginTop={1}>
        <Text color="gray">Space: toggle | A: select all | Enter: confirm</Text>
      </Box>
    </Box>
  );
}
