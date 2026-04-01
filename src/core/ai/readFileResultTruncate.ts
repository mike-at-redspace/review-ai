/** Default max lines before truncation. Overridden by MAX_READ_FILE_LINES from config. */
const DEFAULT_MAX_LINES = 500;

interface ToolArgs {
  file_path?: string;
  offset?: number;
  limit?: number;
  [key: string]: unknown;
}

export interface TruncateResult {
  /** The (possibly truncated) text to return to the model. */
  text: string;
  /** True if the result was truncated. */
  truncated: boolean;
}

/**
 * Truncate a read_file result to `maxLines` and append a pagination hint
 * so the model knows how to request the next chunk.
 *
 * The built-in read_file tool uses: file_path, offset (1-based line), limit (line count).
 */
export function truncateReadFileResult(
  text: string,
  args: unknown,
  maxLines = DEFAULT_MAX_LINES
): TruncateResult {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return { text, truncated: false };

  const { file_path, offset = 1 } = (args ?? {}) as ToolArgs;
  const startLine = Math.max(1, offset);
  const nextOffset = startLine + maxLines;
  const totalLines = lines.length + startLine - 1;

  const truncated = lines.slice(0, maxLines).join("\n");
  const note = [
    "",
    `[TRUNCATED — showing lines ${startLine}–${startLine + maxLines - 1} of ${totalLines}.`,
    `To read more: { "file_path": "${file_path ?? "..."}", "offset": ${nextOffset}, "limit": ${maxLines} }]`,
  ].join("\n");

  return { text: truncated + note, truncated: true };
}
