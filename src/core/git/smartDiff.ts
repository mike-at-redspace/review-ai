import type { ReviewConfig } from "@core/config";

const CONFLICT_MARKERS = /^(<<<<<<<|=======|>>>>>>>|\|\|\|\|\|\|\|)/;

const LOCKFILE_NAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "Cargo.lock",
  "go.sum",
]);
const DEPRIORITIZED_DIRS = ["dist/", "build/", ".cache/", "out/", "coverage/"];
const PREFERRED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".cpp",
  ".c",
  ".h",
  ".rb",
  ".php",
  ".sh",
]);
const MANIFEST_BASES = new Set([
  "package.json",
  "Cargo.toml",
  "go.mod",
  "pyproject.toml",
  "build.gradle",
  "build.gradle.kts",
  "Gemfile",
  "requirements.txt",
]);

const DEFAULT_IMPORT_PATTERNS: Record<string, string> = {
  js: "^(\\s*)(import\\s|export\\s+.*\\s+from\\s+|import\\s*\\()",
  ts: "^(\\s*)(import\\s|export\\s+.*\\s+from\\s+|import\\s+type\\s+|import\\s*\\()",
  python: "^(import\\s|from\\s+.*\\s+import\\s)",
  rust: "^(pub\\s+)?use\\s+",
  go: '^import\\s*\\(|^import\\s+"',
  java: "^import\\s+",
  kt: "^import\\s+",
};

export function sanitizeDiff(diff: string): string {
  const lines = diff.split("\n");
  const kept = lines.filter((line) => !CONFLICT_MARKERS.test(line.trim()));
  const removedAny = kept.length < lines.length;
  const result = kept.join("\n");
  return removedAny
    ? result + "\n[Conflict markers removed from diff.]\n"
    : result;
}

export function getLanguageFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  const ext = base.includes(".")
    ? base.slice(base.lastIndexOf(".")).toLowerCase()
    : "";
  const map: Record<string, string> = {
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
    ".ts": "ts",
    ".tsx": "ts",
    ".js": "js",
    ".jsx": "js",
    ".mjs": "js",
    ".cjs": "js",
    ".java": "java",
    ".kt": "kt",
    ".cpp": "cpp",
    ".c": "cpp",
    ".h": "cpp",
    ".rb": "rb",
    ".php": "php",
    ".sh": "shell",
    ".yml": "none",
    ".yaml": "none",
  };
  if (base === "Makefile" || base === "makefile") return "none";
  return map[ext] ?? "js";
}

const NEVER_MATCH = /(?!)/;

function getImportPatterns(config: ReviewConfig): Record<string, RegExp> {
  const defaults: Record<string, string> = {
    ...DEFAULT_IMPORT_PATTERNS,
    none: "(?!)",
  };
  const custom = config.languageImportPatterns ?? {};
  const combined: Record<string, RegExp> = {};
  for (const lang of new Set([
    ...Object.keys(defaults),
    ...Object.keys(custom),
  ])) {
    const pattern = custom[lang] ?? defaults[lang];
    if (pattern) {
      try {
        combined[lang] = new RegExp(pattern);
      } catch {
        combined[lang] = NEVER_MATCH;
      }
    }
  }
  return Object.keys(combined).length > 0
    ? combined
    : { js: new RegExp(DEFAULT_IMPORT_PATTERNS.js) };
}

export function isImportLine(
  line: string,
  language: string,
  patterns: Record<string, RegExp>
): boolean {
  const trimmed = line.trim();
  if (
    (trimmed.startsWith("+") || trimmed.startsWith("-")) &&
    trimmed.length > 1
  ) {
    const content = trimmed.slice(1).trim();
    const re = patterns[language] ?? patterns["js"] ?? NEVER_MATCH;
    return re.test(content);
  }
  return false;
}

export function collapseImportLines(
  chunk: string,
  path: string,
  config: ReviewConfig
): string {
  if (config.importCollapse === false) return chunk;
  const patterns = getImportPatterns(config);
  const lang = getLanguageFromPath(path);
  const lines = chunk.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!isImportLine(line, lang, patterns)) {
      out.push(line);
      i++;
      continue;
    }
    const prefix = line.trimStart().startsWith("+") ? "+" : "-";
    let count = 0;
    while (
      i < lines.length &&
      isImportLine(lines[i], lang, patterns) &&
      (lines[i].trimStart().startsWith("+") ? "+" : "-") === prefix
    ) {
      count++;
      i++;
    }
    out.push(`${prefix} ... ${count} import line${count !== 1 ? "s" : ""} ...`);
  }
  return out.join("\n");
}

export function pathPriority(path: string): number {
  const base = path.split("/").pop() ?? path;
  if (LOCKFILE_NAMES.has(base)) return 0;
  const lower = path.toLowerCase();
  if (DEPRIORITIZED_DIRS.some((d) => lower.startsWith(d))) return 0;
  if (MANIFEST_BASES.has(base)) return 2;
  const ext = base.includes(".")
    ? base.slice(base.lastIndexOf(".")).toLowerCase()
    : "";
  if (PREFERRED_EXTENSIONS.has(ext)) return 2;
  return 1;
}

function splitDiffIntoFileChunks(
  diff: string
): { path: string; chunk: string }[] {
  const parts = diff.split(/(?=^diff --git )/m).filter(Boolean);
  const chunks: { path: string; chunk: string }[] = [];
  for (const chunk of parts) {
    const match = chunk.match(/^diff --git a\/(.+?) b\/(.+?)(?:\s|$)/m);
    const path = match ? (match[2] ?? match[1]) : "unknown";
    chunks.push({ path, chunk });
  }
  if (chunks.length === 0 && diff.trim()) {
    chunks.push({ path: "unknown", chunk: diff });
  }
  return chunks;
}

function truncateDiff(
  diff: string,
  effectiveLimit: number,
  elevatedPaths: Set<string>
): { content: string; wasTruncated: boolean } {
  if (diff.length <= effectiveLimit) {
    return { content: diff, wasTruncated: false };
  }

  const fileChunks = splitDiffIntoFileChunks(diff);
  const getEffectivePriority = (path: string) =>
    elevatedPaths.has(path) ? 3 : pathPriority(path);

  if (fileChunks.length <= 1) {
    const lines = diff.split("\n");
    const truncatedLines: string[] = [];
    let currentLength = 0;
    for (const line of lines) {
      if (currentLength + line.length + 1 > effectiveLimit) break;
      truncatedLines.push(line);
      currentLength += line.length + 1;
    }
    return { content: truncatedLines.join("\n"), wasTruncated: true };
  }

  const sorted = [...fileChunks].sort(
    (a, b) =>
      getEffectivePriority(b.path) - getEffectivePriority(a.path) ||
      fileChunks.indexOf(a) - fileChunks.indexOf(b)
  );
  const result: string[] = [];
  let currentLength = 0;

  for (const { path, chunk } of sorted) {
    const effectivePrio = getEffectivePriority(path);
    const chunkLen = chunk.length + (result.length ? 1 : 0);
    if (currentLength + chunkLen <= effectiveLimit) {
      result.push(chunk);
      currentLength += chunkLen;
    } else if (currentLength < effectiveLimit && effectivePrio >= 1) {
      const budget =
        effectiveLimit - currentLength - (result.length ? 1 : 0) - 50;
      if (budget > 100) {
        const lines = chunk.split("\n");
        let tailLength = 0;
        const tailLines: string[] = [];
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i];
          if (tailLength + line.length + 1 > budget) break;
          tailLines.unshift(line);
          tailLength += line.length + 1;
        }
        const omitted = lines.length - 1 - tailLines.length;
        const truncatedChunk =
          lines[0] +
          "\n...[truncated, " +
          omitted +
          " line" +
          (omitted !== 1 ? "s" : "") +
          " omitted]...\n" +
          tailLines.join("\n");
        result.push(truncatedChunk);
        currentLength += truncatedChunk.length + (result.length > 1 ? 1 : 0);
      }
      break;
    }
  }

  const content = result.join("\n");
  return {
    content: content || diff.slice(0, effectiveLimit),
    wasTruncated: true,
  };
}

export function getSmartDiff(
  diff: string,
  stat: string | undefined,
  config: ReviewConfig,
  effectiveLimit: number
): { content: string; wasTruncated: boolean } {
  const sanitized = sanitizeDiff(diff);
  const elevatedPaths = new Set<string>();

  const chunks = splitDiffIntoFileChunks(sanitized);
  const collapsedChunks = chunks.map(({ path, chunk }) => ({
    path,
    chunk: collapseImportLines(chunk, path, config),
  }));
  const collapsedDiff =
    collapsedChunks.length === 0
      ? sanitized
      : collapsedChunks.map((c) => c.chunk).join("\n");

  return truncateDiff(collapsedDiff, effectiveLimit, elevatedPaths);
}
