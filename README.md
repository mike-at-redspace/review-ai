# review-ai

Review your local Git changes before you commit. Pick files, stream AI feedback, then chat to drill in and generate `PR-REVIEW.md`.

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

## Quick start

```bash
# Interactive review of current changes
review-ai

# Review staged changes only
review-ai --staged

# Compare branch to main
review-ai --compare-to main

# Non-interactive run and write report
review-ai -y --no-chat

# Non-interactive NDJSON stream (CI)
review-ai -y --json
```

## Interactive flow

1. Select files (arrows, `Space`, `A`, `Enter`)
2. Watch streaming review output
3. Chat with commands like `expand #3`, `rewrite #2`, `focus security`, `ignore #4`, `done`
4. On summary screen: `Enter` opens chat, `D` writes report

## CLI options

| Option                    | Description                                                                       |
| ------------------------- | --------------------------------------------------------------------------------- |
| `-a, --all`               | Include staged + unstaged + untracked                                             |
| `--staged`                | Review staged changes only                                                        |
| `--compare-to <branch>`   | Compare current branch to base (example: `main`)                                  |
| `--files <patterns...>`   | Review matching files only (glob patterns)                                        |
| `-s, --severity <level>`  | Minimum severity: `critical`, `warning`, `info`, `nitpick`                        |
| `--focus <categories...>` | Focus on `bug`, `smell`, `architecture`, `performance`, `readability`, `security` |
| `-o, --output <path>`     | Report path (default: `./PR-REVIEW.md`)                                           |
| `--model <name>`          | Force a specific Copilot model                                                    |
| `--max-diff-length <n>`   | Max diff length before truncation                                                 |
| `--max-diff-tokens <n>`   | Max estimated diff tokens                                                         |
| `--no-import-collapse`    | Disable import collapsing                                                         |
| `-v, --verbose`           | Verbose logs                                                                      |
| `-y, --yes`               | Skip file picker (non-interactive)                                                |
| `--json`                  | Output NDJSON events (requires `--yes`)                                           |
| `--no-chat`               | Skip chat and write report right away                                             |
| `--init`                  | Print config template                                                             |

## Model selection

Use `--model <name>` to force a model, or set `"model"` in config.  
Default is `"model": "auto"`.

- Small diffs (~8k tokens or less): `gpt-5-mini`
- Larger diffs: uses `premiumModel` when set
- If `premiumModel` is not set: picks smallest model tier that fits
- `REVIEW_AI_MODEL` env var overrides config

### `--model` values (Copilot picker snapshot, April 1, 2026)

| CLI string (`--model`) | Context size | Relative cost |
| ---------------------- | ------------ | ------------- |
| `claude-haiku-4-5`     | 200K         | 0.33x         |
| `claude-opus-4-5`      | 200K         | 3x            |
| `claude-opus-4-6`      | 200K         | 3x            |
| `claude-sonnet-4`      | 144K         | 1x            |
| `claude-sonnet-4-5`    | 200K         | 1x            |
| `claude-sonnet-4-6`    | 200K         | 1x            |
| `gemini-2.5-pro`       | 173K         | 1x            |
| `gemini-3-flash`       | 173K         | 0.33x         |
| `gemini-3.1-pro`       | 200K         | 1x            |
| `gpt-4.1`              | 128K         | 0x            |
| `gpt-4o`               | 68K          | 0x            |
| `gpt-5-mini`           | 192K         | 0.33x         |
| `gpt-5.1`              | 192K         | 1x            |
| `gpt-5.1-codex`        | 256K         | 1x            |
| `gpt-5.1-codex-max`    | 256K         | 1x            |
| `gpt-5.1-codex-mini`   | 256K         | 0.33x         |
| `gpt-5.2`              | 400K         | 1x            |
| `gpt-5.2-codex`        | 400K         | 1x            |
| `gpt-5.3-codex`        | 400K         | 1x            |
| `gpt-5.4`              | 400K         | 1x            |
| `gpt-5.4-mini`         | 400K         | 0.33x         |
| `grok-code-fast-1`     | 256K         | 0.25x         |

## Configuration

Create `.review-ai.json` in your project root or home directory:

```json
{
  "model": "auto",
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

Run `review-ai --init` to print the full template.

## NDJSON output (`--json`)

Use with `--yes`. Events written to stdout:

- `progress` (`session`, `sending`, `streaming`, `parsing`)
- `chunk`
- `issue`
- `summary`
- `error`

## Development

```bash
pnpm run dev
pnpm run build
pnpm run lint
pnpm run format
pnpm test
```

## License

MIT
