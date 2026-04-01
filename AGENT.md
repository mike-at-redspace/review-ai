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

## Run and Verify

- Install: `pnpm install`
- Dev run: `pnpm run dev`
- Build: `pnpm run build`
- Test: `pnpm test`
- Lint: `pnpm run lint`

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
