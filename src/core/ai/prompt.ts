import type { ReviewConfig, ReviewIssue } from "@core/config";
import { MAX_DIFF_LENGTH } from "@core/config";

const CHARS_PER_TOKEN = 3.5;

export function getEffectiveDiffLimit(config: ReviewConfig): number {
  const charLimit = config.maxDiffLength ?? MAX_DIFF_LENGTH;
  const tokenLimit = config.maxDiffTokens;
  if (tokenLimit === undefined) return charLimit;
  const maxCharsFromTokens = Math.floor(tokenLimit * CHARS_PER_TOKEN);
  return Math.min(charLimit, maxCharsFromTokens);
}

export const REVIEW_SYSTEM_PROMPT = `You are a senior code reviewer performing a thorough review of uncommitted changes.

Your mission: find real issues that matter — bugs, security holes, performance problems, and maintainability concerns. Skip trivial style nitpicks unless they indicate deeper problems.

Review dimensions (in priority order):
1. **Bugs & Correctness** — Logic errors, null/undefined risks, race conditions, edge cases
2. **Security** — Injection, auth bypass, secrets exposure, unsafe deserialization
3. **Performance** — N+1 queries, unnecessary re-renders, missing memoization, O(n²) in hot paths
4. **Architecture** — Coupling, responsibility violations, missing abstractions, API design
5. **Readability** — Unclear naming, missing context, overly complex logic
6. **Code Smells** — Duplication, dead code, magic numbers, inconsistent patterns

Output format — you MUST use EXACTLY this structure for each issue. Do not deviate from this format:

### [SEVERITY] Category: Title
**File:** \`path/to/file\` (lines X-Y if applicable)
**Description:** Clear explanation of the problem and why it matters.
**Suggestion:** Concrete fix or improvement, with code snippet if helpful.

---

SEVERITY must be one of: CRITICAL, WARNING, INFO, NITPICK (in square brackets).
Category must be one of: bug, security, performance, architecture, readability, smell, style, other.

Example:
### [WARNING] performance: Unbounded array concatenation in hot path
**File:** \`src/core/processor.ts\` (lines 42-48)
**Description:** ...
**Suggestion:** ...

---

Severity level definitions:
- CRITICAL: Will cause bugs, data loss, or security vulnerabilities in production
- WARNING: Likely to cause problems or significantly hinder maintainability
- INFO: Worth improving but not urgent
- NITPICK: Style or preference; mention only if pattern is widespread

Rules:
- Assume the code compiles, passes linting, and tests pass unless the diff proves otherwise. Do not speculate that valid code is broken — if you are unsure whether a package or API exists, err on the side of trusting the author
- Be specific: reference exact variable names, function calls, line patterns from the diff
- Prioritize: put critical issues first
- Be actionable: every issue should have a concrete suggestion
- Be honest: if the code looks good, say so briefly and note any minor improvements
- If the diff is truncated or you cannot see the full contents of a file, do NOT flag issues about code you cannot see. Only review what is visible. Do not hallucinate or guess about hidden content
- Group related issues when they share a root cause
- Do NOT wrap the entire response in markdown code fences`;

export function buildReviewPrompt(
  diff: string,
  config: ReviewConfig,
  branch: string,
  stat?: string,
  wasTruncated?: boolean
): string {
  let prompt = "";

  if (stat) {
    prompt += `File change summary:\n${stat}\n\n`;
  }

  prompt += `Review the following uncommitted changes:\n\n${diff}`;

  if (wasTruncated) {
    prompt +=
      "\n\n[Note: Diff was truncated due to size. Review visible changes and note that coverage is partial.]";
  }

  prompt += `\n\nBranch: ${branch}`;

  const instructions: string[] = [];

  if (config.minSeverity !== "nitpick") {
    const severityOrder = ["critical", "warning", "info", "nitpick"];
    const minIndex = severityOrder.indexOf(config.minSeverity);
    const included = severityOrder.slice(0, minIndex + 1);
    instructions.push(`Only report issues at severity: ${included.join(", ")}`);
  }

  if (config.focusCategories.length > 0) {
    instructions.push(
      `Focus especially on: ${config.focusCategories.join(", ")}`
    );
  }

  if (instructions.length > 0) {
    prompt += `\n\nReview instructions:\n${instructions.map((i) => `- ${i}`).join("\n")}`;
  }

  return prompt;
}

export function buildExpandPrompt(issue: ReviewIssue): string {
  return `Expand on issue #${issue.id}: "${issue.title}" in \`${issue.file}\`.

Provide:
1. A more detailed explanation of why this is a problem
2. The specific impact if left unfixed
3. A complete code fix (show the before and after)
4. Any related patterns in the codebase that might have the same issue`;
}

export function buildFocusPrompt(area: string): string {
  return `Re-examine the changes with a specific focus on **${area}**.

Look for issues you may have missed in your initial review that relate to ${area}. Reference specific code from the diff. Use the same output format (### [SEVERITY] Category: Title).`;
}

export function buildRewritePrompt(issue: ReviewIssue): string {
  return `For issue #${issue.id}: "${issue.title}" in \`${issue.file}\`:

Provide a complete rewritten version of the affected code that fixes this issue. Show:
1. The current problematic code (from the diff)
2. The improved version
3. Brief explanation of what changed and why

Output the code in fenced blocks with the appropriate language tag.`;
}
