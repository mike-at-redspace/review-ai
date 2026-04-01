import type { Severity } from "./types.js";

export const VERSION = "1.0.0";
export const CONFIG_FILENAME = ".review-ai.json";
export const MAX_GIT_BUFFER_SIZE = 10 * 1024 * 1024;
export const MAX_DIFF_LENGTH = 8000;
export const CHARS_PER_TOKEN = 3.5;
export const COPILOT_SESSION_TIMEOUT = 120000;
export const COPILOT_CLIENT_STOP_TIMEOUT_MS = 5000;
export const DEFAULT_COPILOT_MODEL = "auto";
export const DEFAULT_PREMIUM_MODEL = "gpt-5.3-codex";
export const DEFAULT_RECENT_COMMITS_COUNT = 5;
export const MIN_TERMINAL_COLUMNS = 60;
export const MIN_TERMINAL_ROWS = 20;

export const LOGO_ANIMATION_COLORS = [
  "green",
  "cyan",
  "blue",
  "magenta",
  "yellow",
] as const;

export const LOGO_LINES = [
  "┌─┐┌─┐┬  ┬┬┌─┐┬ ┬  ┌─┐┬",
  "├┬┘├┤ └┐┌┘│├┤ │││  ├─┤│",
  "┴└─└─┘ └┘ ┴└─┘└┴┘  ┴ ┴┴",
];

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "red",
  warning: "yellow",
  info: "blue",
  nitpick: "gray",
};

export const SEVERITY_EMOJI: Record<Severity, string> = {
  critical: "\u{1F534}",
  warning: "\u{1F7E1}",
  info: "\u{1F535}",
  nitpick: "\u{26AA}",
};

export const PROGRESS_SPINNER_LABELS: Record<string, string> = {
  session: "Creating Copilot session...",
  sending: "Sending diff to Copilot...",
  streaming: "Reviewing code...",
  parsing: "Parsing review results...",
};

export const PROGRESS_STEP_LABELS: Record<string, string> = {
  connecting: "connecting to Copilot",
  session: "creating Copilot session",
  sending: "sending diff",
  streaming: "reviewing code",
  parsing: "parsing results",
};

export const INITIAL_PROGRESS_PHASE = "connecting";
