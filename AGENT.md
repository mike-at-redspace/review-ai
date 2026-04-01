# AGENT.md for review-ai + Context7

## Purpose

`review-ai` is a CLI for AI-powered pre-commit code review of local Git changes. It supports:

- Interactive terminal workflow (file selection, streamed review, follow-up chat)
- Non-interactive and CI workflows (including NDJSON output)
- Markdown report generation (`PR-REVIEW.md`)

## Local Codebase Map

- Entry point: `src/cli.ts`
- Core review logic: `src/core/ai/`
  - `reviewer.ts`, `parser.ts`, `prompt.ts`, `modelSelector.ts`, `markdownGenerator.ts`
- Git change and diff processing: `src/core/git/`
  - `git.ts`, `smartDiff.ts`
- Config and types: `src/core/config/`
- Output sink for human/JSON modes: `src/core/outputSink.ts`
- Ink/React terminal UI: `src/ui/`
  - Feature flows in `src/ui/features/`
  - Layout primitives in `src/ui/layout/`

## Key Patterns

- **Copilot SDK**: Sessions via `@github/copilot-sdk`. `CopilotClient.createSession()` with `onPermissionRequest: approveAll` enables tool use. `session.sendAndWait()` handles multi-turn tool calls internally. Event types: `assistant.message_delta`, `assistant.message`, `tool.execution_start` (data: `toolName`, `arguments`), `tool.execution_complete` (data: `toolName`, `success`, `result`).
- **Path aliases**: `@core/*` = `src/core/*`, `@ui/*` = `src/ui/*`. Resolved by `tsc-alias` post-build.
- **State management**: Custom `createStore`/`useStore` (pub-sub with `useSyncExternalStore`) in `src/core/store.ts`. Stream state in `src/core/streamStore.ts`. No Redux/Zustand.
- **Progress phases**: `ReviewProgressPhase` in `types.ts` drives both the interactive `ProgressBar` and non-interactive `OutputSink`. Adding a phase requires updating: the union type, `PROGRESS_SPINNER_LABELS`, `PROGRESS_STEP_LABELS`, and both sinks.
- **OutputSink interface**: All methods must be implemented on both `HumanSink` (stderr/stdout) and `JsonSink` (NDJSON). Adding a method to the interface without implementing on both sinks will break the build.
- **Prompt assembly**: System prompt in `BASE_SYSTEM_PROMPT` (prompt.ts). User message built by `buildReviewPrompt()`. The model's output format (`### [SEVERITY] Category: Title`) is parsed by `parser.ts` — don't change the format instructions without updating the parser regex.
- **Git executor**: All git commands go through a pluggable `GitExecutor` (git.ts) — don't shell out directly. This enables test mocking.

## Run and Verify

- Install: `pnpm install`
- Dev run: `pnpm run dev`
- Build: `pnpm run build`
- Test: `pnpm test`
- Lint: `pnpm run lint`
- Format: `pnpm run format`
- Full check: `pnpm run build && pnpm run lint && npx prettier --check "src/**/*.{ts,tsx}" && pnpm test`

## Canonical External Reference (Context7)

Use this as the authoritative long-form reference for this repo:

- URL: https://context7.com/mike-at-redspace/review-ai/llms.txt
- Context7 library ID: `/mike-at-redspace/review-ai`

Prefer this doc for architecture, CLI flags, config keys, integration examples, and usage details instead of guessing from stale model knowledge.

## Using Context7 MCP

Use the Context7 MCP server (often named `user-context7`) with these tools:

1. `resolve-library-id`

- Use when library ID is unknown.
- Required args: `libraryName`, `query`
- Example intent: resolve `review-ai` to a Context7 library ID.

2. `query-docs`

- Use to retrieve docs snippets and examples.
- Required args: `libraryId`, `query`
- For this repo, use `libraryId: "/mike-at-redspace/review-ai"` when known.

Notes:

- If the exact library ID is already known, call `query-docs` directly.
- Keep questions specific.
- Tool descriptors indicate a practical cap of about 3 calls per question.

## When to Use vs Not Use Context7

Use Context7 for library/framework/API/CLI documentation and current usage details.
Do not use it as a primary tool for local refactoring strategy, business-logic debugging, or generic code review of unrelated code.

## Fallback Without MCP

If Context7 MCP is unavailable, fetch/read:

- https://context7.com/mike-at-redspace/review-ai/llms.txt

This provides the same repo-specific long-form content for agent guidance.
