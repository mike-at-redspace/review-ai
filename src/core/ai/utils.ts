/** Extract a file path from raw Copilot SDK tool arguments JSON. */
export function parseToolFilePath(args?: string): string | undefined {
  if (!args) return undefined;
  try {
    const { file_path, path } = JSON.parse(args);
    return file_path ?? path;
  } catch {
    return args;
  }
}
