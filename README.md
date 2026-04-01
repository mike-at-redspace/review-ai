# review-ai

An interactive terminal UI for reviewing your working changes before committing. Select files, get a streaming AI review, then chat with the reviewer to expand on issues, request rewrites, or focus on specific areas. Generates a `PR-REVIEW.md` report when done.

<img width="45%" height="auto" alt="image" src="https://github.com/user-attachments/assets/1576e276-a01e-4426-b912-88ed5855e023" />

<img width="45%" height="730" alt="image" src="https://github.com/user-attachments/assets/10ed8cc5-86a7-484d-a438-44d3dc8aa0ba" />

## Requirements

- Node.js >= 18
- GitHub Copilot access (authenticated via GitHub CLI)

## Install

```bash
pnpm install
pnpm run build
pnpm link --global
```

## Usage

```bash
# Interactive review of uncommitted changes
review-ai

# Review only staged changes
review-ai --staged

# Compare current branch against main
review-ai --compare-to main

# Non-interactive — review all files and generate report
review-ai -y --no-chat

# Use a specific model
review-ai --model gpt-5.3-codex

# Filter to specific files (glob patterns)
review-ai --files "src/core/**/*.ts"

# Focus on security and performance issues only
review-ai --focus security performance

# Only show warnings and above
review-ai -s warning
```

## Interactive Mode

1. **File selection** — choose which files to include in the review. Arrow keys to navigate, Space to toggle, A to select all, Enter to confirm.
2. **Streaming review** — the AI reviews your changes in real-time, outputting structured issues with severity levels.
3. **Chat loop** — interact with the reviewer:
   - Ask to **expand** on any issue for more detail
   - **Ignore** issues you disagree with
   - **Focus** on a specific area (e.g. "focus on error handling")
   - Request a **rewrite** of problematic code
   - Type **done** to generate the report

## CLI Options

| Option | Description |
|--------|-------------|
| `-a, --all` | Include all changes (staged + unstaged + untracked) |
| `--staged` | Review only staged changes |
| `--compare-to <branch>` | Compare current branch to a base branch (e.g. main) |
| `--files <patterns...>` | Only review specific files (glob patterns) |
| `-s, --severity <level>` | Minimum severity: `critical`, `warning`, `info`, `nitpick` |
| `--focus <categories...>` | Focus on: `bug`, `smell`, `architecture`, `performance`, `readability`, `security` |
| `-o, --output <path>` | Output path for report (default: `./PR-REVIEW.md`) |
| `--model <name>` | Override Copilot model |
| `--max-diff-length <n>` | Max diff length in characters before truncation |
| `--max-diff-tokens <n>` | Max diff size in estimated tokens |
| `--no-import-collapse` | Disable import line collapsing |
| `-v, --verbose` | Show verbose output |
| `-y, --yes` | Skip file selection, review all changes non-interactively |
| `--no-chat` | Skip interactive chat, generate report immediately |
| `--init` | Show config file template |

## Configuration

Create a `.review-ai.json` in your project root or home directory:

```json
{
  "model": "gpt-5-mini",
  "premiumModel": "gpt-5.3-codex",
  "minSeverity": "nitpick",
  "focusCategories": [],
  "maxDiffLength": 8000,
  "ignoreWhitespaceInDiff": false,
  "importCollapse": true,
  "outputPath": "./PR-REVIEW.md",
  "autoOpen": false
}
```

Run `review-ai --init` to print the full config template.

The `REVIEW_AI_MODEL` environment variable overrides the model setting.

## Severity Levels

| Level | Meaning |
|-------|---------|
| `critical` | Bugs, data loss, or security vulnerabilities |
| `warning` | Likely problems or maintainability concerns |
| `info` | Worth improving but not urgent |
| `nitpick` | Style or preference |

## Development

```bash
pnpm run dev          # Run with tsx (no build needed)
pnpm run build        # Compile TypeScript
pnpm run lint         # ESLint
pnpm run format       # Prettier
pnpm test             # Vitest
```

## License

MIT
