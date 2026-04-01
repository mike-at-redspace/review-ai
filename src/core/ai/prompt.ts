import type { ReviewConfig, ReviewIssue } from "@core/config";
import {
  CHARS_PER_TOKEN,
  MAX_DIFF_LENGTH,
  MAX_REPO_MAP_FILES,
} from "@core/config";

export function getEffectiveDiffLimit({
  maxDiffLength,
  maxDiffTokens,
}: ReviewConfig): number {
  const charLimit = maxDiffLength ?? MAX_DIFF_LENGTH;
  if (maxDiffTokens === undefined) return charLimit;
  return Math.min(charLimit, Math.floor(maxDiffTokens * CHARS_PER_TOKEN));
}

// --- System Prompt ---

const BASE_SYSTEM_PROMPT = `You are a Senior JavaScript/TypeScript Architect. You treat code as craft — readable over clever, more with less.

Mission: find bugs, security holes, performance traps, and architectural debt. Skip trivial nits unless they signal a deeper pattern.

Review dimensions (priority order):
1. Security — Audit for injection, auth bypass, and exposed secrets. Never trust external input.
2. Bugs & Correctness — Trace edge cases, race conditions, and null/undefined risks. Ensure logic is resilient.
3. Performance — Flag N+1 queries, O(n²) hot paths, and expensive re-renders. Optimize only where it matters.
4. Architecture — Enforce separation of concerns. Flag tight coupling, leaky abstractions, and API contract violations.
5. Clarity & Intent — Name by purpose, not type (no data/info suffixes). Flatten nested logic with guard clauses and ??.
6. Craftsmanship — Eradicate "Magic Numbers" and "Swiss Army" functions. Replace primitive obsession with clean destructuring. If it’s not DRY and readable, it’s not finished.

Output format — use EXACTLY this structure per issue:

### [SEVERITY] Category: Title
**File:** \`path/to/file\` (lines X-Y if applicable)
**Description:** Why it matters.
**Suggestion:** Concrete fix with code snippet.

---

Severities: CRITICAL, WARNING, INFO, NITPICK (in brackets).
Categories: bug, security, performance, architecture, readability, smell, style, other.

Rules:
- Trust the author — assume code compiles, types check, and tests pass unless the diff proves otherwise
- Be specific: reference exact names, calls, line patterns from the diff
- Be actionable: every issue gets a concrete suggestion
- Prefer modern JS in suggestions: spread, destructuring, nullish coalescing, optional chaining
- If the code looks good, say so briefly
- Group related issues sharing a root cause

How to use \`read_file\` — your most important tool:
A repository file listing is provided in the user message. Use \`read_file\` liberally.

Before you write a single issue, scan the diff for unknowns:
- Imported symbols you haven't seen defined → read the source file
- Function calls where you can't see the signature → read it
- Types, interfaces, or constants referenced but not in the diff → read them
- Changed function signatures → read every caller to check compatibility

Do this FIRST, during your initial analysis pass. Don't wait until you're mid-sentence on an issue to realize you need context — front-load it. Reading 3-5 files before writing anything is normal and expected.

The goal: by the time you write your review, you should have zero open questions about the code. Every claim should be grounded in code you have actually read, not inferred from a diff hunk.

If after reading you still can't determine whether something is a problem, say so honestly and mark it INFO — never CRITICAL on incomplete evidence. Only use CRITICAL for issues you can prove from code you have read.

TypeScript types are contracts. If a value comes from a typed parameter, the compiler enforces it — do not flag it as "potentially undefined." A diff that compiles is evidence.`;

export function buildSystemPrompt({
  focusCategories,
  minSeverity,
}: ReviewConfig): string {
  const sections = [BASE_SYSTEM_PROMPT];

  if (minSeverity !== "nitpick") {
    const order = ["critical", "warning", "info", "nitpick"];
    sections.push(
      `Only report: ${order.slice(0, order.indexOf(minSeverity) + 1).join(", ")}`
    );
  }

  if (focusCategories.length) {
    sections.push(`Focus on: ${focusCategories.join(", ")}`);
  }

  return sections.join("\n\n");
}

// --- User Message ---

function buildRepoMapSection(
  repoFiles: string[],
  config: ReviewConfig
): string {
  if (!repoFiles.length) return "";

  const budget = Math.floor(getEffectiveDiffLimit(config) * 0.2);
  let charCount = 0;
  const visible = repoFiles
    .filter((file) => {
      charCount += file.length + 1;
      return charCount <= budget;
    })
    .slice(0, MAX_REPO_MAP_FILES);

  const omitted = repoFiles.length - visible.length;
  const suffix = omitted > 0 ? `\n[...and ${omitted} more]` : "";
  return `Repo files (${repoFiles.length} tracked):\n${visible.join("\n")}${suffix}`;
}

export function buildReviewPrompt(
  diff: string,
  config: ReviewConfig,
  branch: string,
  stat?: string,
  wasTruncated?: boolean,
  repoFiles: string[] = [],
  pathAliases?: Record<string, string>
): string {
  const { minSeverity, focusCategories } = config;
  const sections: string[] = [];

  if (pathAliases && Object.keys(pathAliases).length) {
    const lines = Object.entries(pathAliases)
      .map(([alias, target]) => `  ${alias} → ${target}`)
      .join("\n");
    sections.push(
      `Import path aliases — do NOT pass aliases like "${Object.keys(pathAliases)[0]}" to read_file. Resolve to real paths first:\n${lines}`
    );
  }

  const repoMap = buildRepoMapSection(repoFiles, config);
  if (repoMap) sections.push(repoMap);

  if (stat) sections.push(`Summary:\n${stat}`);

  const truncNote = wasTruncated ? "\n\n[Note: Diff truncated]" : "";
  sections.push(
    `Changes to review (branch: ${branch}):\n\n${diff}${truncNote}`
  );

  const instructions: string[] = [];
  if (minSeverity !== "nitpick") {
    const order = ["critical", "warning", "info", "nitpick"];
    instructions.push(
      `Only report: ${order.slice(0, order.indexOf(minSeverity) + 1).join(", ")}`
    );
  }
  if (focusCategories.length) {
    instructions.push(`Focus on: ${focusCategories.join(", ")}`);
  }
  if (instructions.length) {
    sections.push(
      `Instructions:\n${instructions.map((i) => `- ${i}`).join("\n")}`
    );
  }

  return sections.join("\n\n");
}

// --- Follow-up Prompts ---

export function buildExpandPrompt({ id, title, file }: ReviewIssue): string {
  return `Deep dive into issue #${id}: "${title}" in \`${file}\`.
Provide: detailed impact, before/after code fix, and codebase-wide patterns.`;
}

export function buildFocusPrompt(area: string): string {
  return `Re-examine changes focusing on **${area}**. Use the standard format.`;
}

export function buildRewritePrompt({ id, title, file }: ReviewIssue): string {
  return `Rewrite code for issue #${id} ("${title}" in \`${file}\`).
Show current vs. improved. Prioritize readability and modern JS/TS idioms.`;
}
