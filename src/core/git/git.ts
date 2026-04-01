import { spawn } from "child_process";
import type { ChangedFile, GitChanges, GitExecutor } from "@core/config";
import {
  DEFAULT_RECENT_COMMITS_COUNT,
  MAX_GIT_BUFFER_SIZE,
} from "@core/config";

let executor: GitExecutor = defaultExecutor;

export function setGitExecutor(fn?: GitExecutor): void {
  executor = fn ?? defaultExecutor;
}

function defaultExecutor(
  command: string,
  options?: { input?: string }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("sh", ["-c", command], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    const chunks: Buffer[] = [];
    let totalSize = 0;
    let exceeded = false;

    proc.stdout?.on("data", (chunk: Buffer) => {
      if (exceeded) return;
      totalSize += chunk.length;
      if (totalSize > MAX_GIT_BUFFER_SIZE) {
        exceeded = true;
        proc.kill("SIGKILL");
        reject(new Error("Git output exceeded maximum buffer size"));
        return;
      }
      chunks.push(chunk);
    });
    proc.stderr?.on("data", () => {});

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (exceeded) return;
      if (code !== 0) {
        reject(new Error(`Git command failed with code ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });

    if (options?.input !== undefined) {
      proc.stdin?.setDefaultEncoding("utf-8");
      proc.stdin?.write(options.input, () => {
        proc.stdin?.end();
      });
    }
  });
}

export async function isGitRepository(): Promise<boolean> {
  try {
    await executor("git rev-parse --is-inside-work-tree");
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentBranch(): Promise<string> {
  try {
    const output = await executor("git branch --show-current");
    return output.trim();
  } catch {
    return "unknown";
  }
}

export async function getRecentCommits(
  count: number = DEFAULT_RECENT_COMMITS_COUNT
): Promise<string[]> {
  try {
    const output = await executor(`git log --oneline -${count}`);
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".svg",
  ".webp",
  ".avif",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".7z",
  ".rar",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".mp3",
  ".mp4",
  ".wav",
  ".avi",
  ".mov",
  ".sqlite",
  ".db",
]);

function isBinaryFile(path: string): boolean {
  const ext = path.includes(".")
    ? path.slice(path.lastIndexOf(".")).toLowerCase()
    : "";
  return BINARY_EXTENSIONS.has(ext);
}

function parseNameStatus(
  output: string
): { path: string; status: "added" | "modified" | "deleted" | "renamed" }[] {
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      const statusChar = parts[0]?.charAt(0) ?? "M";
      const filePath = parts.length >= 3 ? parts[2] : (parts[1] ?? "");
      const statusMap: Record<
        string,
        "added" | "modified" | "deleted" | "renamed"
      > = {
        A: "added",
        M: "modified",
        D: "deleted",
        R: "renamed",
      };
      return {
        path: filePath,
        status: statusMap[statusChar] ?? "modified",
      };
    });
}

export async function getAllChanges(options?: {
  stagedOnly?: boolean;
  ignoreWhitespace?: boolean;
  compareTo?: string;
}): Promise<GitChanges> {
  const branch = await getCurrentBranch();
  const wsFlag = options?.ignoreWhitespace ? " -w" : "";

  // Compare to a base branch (e.g. main) — uses three-dot diff
  if (options?.compareTo) {
    const base = options.compareTo;
    const committedOutput = await executor(
      `git diff ${base}...HEAD --name-status${wsFlag}`
    ).catch(() => "");
    const committedFiles = parseNameStatus(committedOutput);

    const fileMap = new Map<
      string,
      { status: "added" | "modified" | "deleted" | "renamed"; staged: boolean }
    >();

    // Include changes already committed on this branch.
    for (const f of committedFiles) {
      fileMap.set(f.path, { status: f.status, staged: false });
    }

    // Include uncommitted changes on top of branch commits.
    const stagedOutput = await executor(
      `git diff --staged --name-status${wsFlag}`
    ).catch(() => "");
    const stagedFiles = parseNameStatus(stagedOutput);
    for (const f of stagedFiles) {
      fileMap.set(f.path, { status: f.status, staged: true });
    }

    if (!options?.stagedOnly) {
      const unstagedOutput = await executor(
        `git diff --name-status${wsFlag}`
      ).catch(() => "");
      const unstagedFiles = parseNameStatus(unstagedOutput);
      for (const f of unstagedFiles) {
        if (fileMap.has(f.path) && fileMap.get(f.path)?.staged) continue;
        fileMap.set(f.path, { status: f.status, staged: false });
      }

      const untrackedOutput = await executor(
        "git ls-files --others --exclude-standard"
      ).catch(() => "");
      const untrackedPaths = untrackedOutput.trim().split("\n").filter(Boolean);
      for (const path of untrackedPaths) {
        fileMap.set(path, { status: "added", staged: false });
      }
    }

    const files: ChangedFile[] = [];
    for (const [path, meta] of fileMap.entries()) {
      const binary = isBinaryFile(path);
      let diff = "";
      if (!binary) {
        const segments: string[] = [];

        // Changes already committed on this branch versus base.
        const committedSegment = await executor(
          `git diff ${base}...HEAD${wsFlag} -- "${path}"`
        ).catch(() => "");
        if (committedSegment.trim()) {
          segments.push(committedSegment);
        }

        // Staged changes in the working tree.
        const stagedSegment = await executor(
          `git diff --staged${wsFlag} -- "${path}"`
        ).catch(() => "");
        if (stagedSegment.trim()) {
          segments.push(stagedSegment);
        }

        // Unstaged working tree changes (unless staged-only mode).
        if (!options?.stagedOnly) {
          const unstagedSegment = await executor(
            `git diff${wsFlag} -- "${path}"`
          ).catch(() => "");
          if (unstagedSegment.trim()) {
            segments.push(unstagedSegment);
          }

          // Truly untracked files need a no-index diff to produce patch text.
          if (meta.status === "added" && segments.length === 0) {
            const noIndexSegment = await executor(
              `git diff --no-index /dev/null "${path}" || true`
            ).catch(() => "");
            if (noIndexSegment.trim()) {
              segments.push(noIndexSegment);
            }
          }
        }

        diff = segments.join("\n");
      }

      files.push({
        path,
        status: meta.status,
        staged: meta.staged,
        binary,
        diff,
      });
    }

    let stat: string | undefined;
    try {
      const committedStat = await executor(
        `git diff ${base}...HEAD --stat${wsFlag}`
      ).catch(() => "");
      const parts: string[] = [];
      if (committedStat.trim()) parts.push(committedStat.trim());
      const stagedStat = await executor(
        `git diff --staged --stat${wsFlag}`
      ).catch(() => "");
      if (stagedStat.trim()) parts.push(stagedStat.trim());
      if (!options?.stagedOnly) {
        const unstagedStat = await executor(`git diff --stat${wsFlag}`).catch(
          () => ""
        );
        if (unstagedStat.trim()) parts.push(unstagedStat.trim());
      }
      stat = parts.length > 0 ? parts.join("\n") : undefined;
    } catch {
      stat = undefined;
    }

    const combinedDiff = files
      .filter((f) => !f.binary && f.diff)
      .map((f) => f.diff)
      .join("\n");

    return { files, combinedDiff, stat, branch };
  }

  // Staged files
  const stagedOutput = await executor(
    `git diff --staged --name-status${wsFlag}`
  ).catch(() => "");
  const stagedFiles = parseNameStatus(stagedOutput);

  // Unstaged tracked files
  let unstagedFiles: ReturnType<typeof parseNameStatus> = [];
  if (!options?.stagedOnly) {
    const unstagedOutput = await executor(
      `git diff --name-status${wsFlag}`
    ).catch(() => "");
    unstagedFiles = parseNameStatus(unstagedOutput);
  }

  // Untracked files
  let untrackedPaths: string[] = [];
  if (!options?.stagedOnly) {
    const untrackedOutput = await executor(
      "git ls-files --others --exclude-standard"
    ).catch(() => "");
    untrackedPaths = untrackedOutput.trim().split("\n").filter(Boolean);
  }

  // Build file map (dedup: staged takes precedence)
  const fileMap = new Map<string, ChangedFile>();

  for (const f of stagedFiles) {
    const binary = isBinaryFile(f.path);
    let diff = "";
    if (!binary) {
      diff = await executor(`git diff --staged${wsFlag} -- "${f.path}"`).catch(
        () => ""
      );
    }
    fileMap.set(f.path, {
      path: f.path,
      status: f.status,
      staged: true,
      binary,
      diff,
    });
  }

  for (const f of unstagedFiles) {
    if (fileMap.has(f.path)) continue;
    const binary = isBinaryFile(f.path);
    let diff = "";
    if (!binary) {
      diff = await executor(`git diff${wsFlag} -- "${f.path}"`).catch(() => "");
    }
    fileMap.set(f.path, {
      path: f.path,
      status: f.status,
      staged: false,
      binary,
      diff,
    });
  }

  for (const path of untrackedPaths) {
    if (fileMap.has(path)) continue;
    const binary = isBinaryFile(path);
    let diff = "";
    if (!binary) {
      diff = await executor(
        `git diff --no-index /dev/null "${path}" || true`
      ).catch(() => "");
    }
    fileMap.set(path, {
      path,
      status: "added",
      staged: false,
      binary,
      diff,
    });
  }

  const files = Array.from(fileMap.values());

  // Combined stat
  let stat: string | undefined;
  try {
    const parts: string[] = [];
    const stagedStat = await executor(
      `git diff --staged --stat${wsFlag}`
    ).catch(() => "");
    if (stagedStat.trim()) parts.push(stagedStat.trim());
    if (!options?.stagedOnly) {
      const unstagedStat = await executor(`git diff --stat${wsFlag}`).catch(
        () => ""
      );
      if (unstagedStat.trim()) parts.push(unstagedStat.trim());
    }
    stat = parts.length > 0 ? parts.join("\n") : undefined;
  } catch {
    stat = undefined;
  }

  // Combined diff
  const combinedDiff = files
    .filter((f) => !f.binary && f.diff)
    .map((f) => f.diff)
    .join("\n");

  return { files, combinedDiff, stat, branch };
}
