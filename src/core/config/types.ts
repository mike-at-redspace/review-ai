export type Severity = "critical" | "warning" | "info" | "nitpick";

export type ReviewCategory =
  | "bug"
  | "smell"
  | "architecture"
  | "performance"
  | "readability"
  | "security"
  | "style"
  | "other";

export interface ReviewIssue {
  id: number;
  severity: Severity;
  file: string;
  lineRange?: { start: number; end?: number };
  category: ReviewCategory;
  title: string;
  description: string;
  suggestion?: string;
  ignored: boolean;
}

export interface ChangedFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  staged: boolean;
  binary: boolean;
  diff: string;
  stat?: { added: number; removed: number };
}

export interface GitChanges {
  files: ChangedFile[];
  combinedDiff: string;
  stat?: string;
  branch: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ReviewSession {
  selectedFiles: string[];
  diff: string;
  issues: ReviewIssue[];
  chatHistory: ChatMessage[];
  branch: string;
  startedAt: number;
}

export interface ReviewConfig {
  model: string;
  premiumModel?: string;
  maxDiffLength?: number;
  maxDiffTokens?: number;
  minSeverity: Severity;
  focusCategories: ReviewCategory[];
  ignoreWhitespaceInDiff?: boolean;
  importCollapse?: boolean;
  languageImportPatterns?: Record<string, string>;
  outputPath: string;
  autoOpen: boolean;
}

export type ReviewProgressPhase =
  | "session"
  | "sending"
  | "streaming"
  | "parsing";

export type GitExecutor = (
  command: string,
  options?: { input?: string }
) => Promise<string>;

// Discriminated union view state — each state carries its own data
export type ViewState =
  | { type: "file-selection" }
  | { type: "reviewing"; phase: ReviewProgressPhase }
  | { type: "review-complete" }
  | { type: "chatting" }
  | { type: "generating-report" }
  | { type: "done"; outputPath: string }
  | { type: "error"; message: string };

// Typed chat commands
export type ChatCommand =
  | { type: "expand"; issueId: number }
  | { type: "ignore"; issueId: number }
  | { type: "focus"; area: string }
  | { type: "rewrite"; issueId: number }
  | { type: "done" }
  | { type: "freeform"; text: string };

export type OutputMode = "human" | "json";

// Output sink for structured / human output
export interface OutputSink {
  progress(phase: ReviewProgressPhase): void;
  issue(issue: ReviewIssue): void;
  summary(session: ReviewSession): void;
  error(err: unknown): void;
  chunk(text: string): void;
}
