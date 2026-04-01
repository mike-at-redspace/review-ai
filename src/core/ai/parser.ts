import type { ReviewCategory, ReviewIssue, Severity } from "@core/config";

const ISSUE_HEADER_REGEX = /^###\s*\[(\w+)\]\s*(\w+):\s*(.+)$/;
const ISSUE_HEADER_ALT_REGEX = /^###\s+(\w+):\s*(.+)$/;
const FILE_REGEX =
  /^\*\*File:\*\*\s*`([^`]+)`(?:\s*\(lines?\s*(\d+)(?:-(\d+))?\))?/;
const DESCRIPTION_REGEX = /^\*\*Description:\*\*\s*(.+)/;
const SUGGESTION_REGEX = /^\*\*Suggestion:\*\*\s*(.+)/;

const VALID_SEVERITIES = new Set(["critical", "warning", "info", "nitpick"]);
const VALID_CATEGORIES = new Set([
  "bug",
  "smell",
  "architecture",
  "performance",
  "readability",
  "security",
  "style",
  "other",
]);

function parseSeverity(raw: string): Severity {
  const lower = raw.toLowerCase();
  return VALID_SEVERITIES.has(lower) ? (lower as Severity) : "info";
}

function parseCategory(raw: string): ReviewCategory {
  const lower = raw.toLowerCase();
  return VALID_CATEGORIES.has(lower) ? (lower as ReviewCategory) : "other";
}

export function parseReviewResponse(rawText: string): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const lines = rawText.split("\n");
  let currentIssue: Partial<ReviewIssue> | null = null;
  let descriptionLines: string[] = [];
  let suggestionLines: string[] = [];
  let collectingDescription = false;
  let collectingSuggestion = false;
  let nextId = 1;

  function finalizeIssue() {
    if (currentIssue && currentIssue.title) {
      issues.push({
        id: nextId++,
        severity: currentIssue.severity ?? "info",
        file: currentIssue.file ?? "unknown",
        lineRange: currentIssue.lineRange,
        category: currentIssue.category ?? "other",
        title: currentIssue.title,
        description: descriptionLines.join("\n").trim() || currentIssue.title,
        suggestion: suggestionLines.join("\n").trim() || undefined,
        ignored: false,
      });
    }
    currentIssue = null;
    descriptionLines = [];
    suggestionLines = [];
    collectingDescription = false;
    collectingSuggestion = false;
  }

  for (const line of lines) {
    const headerMatch = line.match(ISSUE_HEADER_REGEX);
    if (headerMatch) {
      finalizeIssue();
      currentIssue = {
        severity: parseSeverity(headerMatch[1]),
        category: parseCategory(headerMatch[2]),
        title: headerMatch[3].trim(),
      };
      continue;
    }

    const altHeaderMatch = line.match(ISSUE_HEADER_ALT_REGEX);
    if (altHeaderMatch) {
      const firstWord = altHeaderMatch[1].toLowerCase();
      if (VALID_SEVERITIES.has(firstWord)) {
        finalizeIssue();
        currentIssue = {
          severity: parseSeverity(altHeaderMatch[1]),
          category: "other",
          title: altHeaderMatch[2].trim(),
        };
        continue;
      }
    }

    if (!currentIssue) continue;

    const fileMatch = line.match(FILE_REGEX);
    if (fileMatch) {
      currentIssue.file = fileMatch[1];
      if (fileMatch[2]) {
        currentIssue.lineRange = {
          start: parseInt(fileMatch[2], 10),
          end: fileMatch[3] ? parseInt(fileMatch[3], 10) : undefined,
        };
      }
      collectingDescription = false;
      collectingSuggestion = false;
      continue;
    }

    const descMatch = line.match(DESCRIPTION_REGEX);
    if (descMatch) {
      collectingDescription = true;
      collectingSuggestion = false;
      descriptionLines.push(descMatch[1]);
      continue;
    }

    const suggMatch = line.match(SUGGESTION_REGEX);
    if (suggMatch) {
      collectingSuggestion = true;
      collectingDescription = false;
      suggestionLines.push(suggMatch[1]);
      continue;
    }

    if (line.trim() === "---") {
      continue;
    }

    if (collectingSuggestion) {
      suggestionLines.push(line);
    } else if (collectingDescription) {
      descriptionLines.push(line);
    }
  }

  finalizeIssue();

  // Fallback: if no issues parsed, treat entire response as a single info issue
  if (issues.length === 0 && rawText.trim()) {
    issues.push({
      id: 1,
      severity: "info",
      file: "general",
      category: "other",
      title: "Review Summary",
      description: rawText.trim(),
      ignored: false,
    });
  }

  return issues;
}
