#!/usr/bin/env node

import { program } from "commander";
import chalk from "chalk";
import { CopilotClient } from "@github/copilot-sdk";
import { loadConfig, getConfigTemplate } from "@core/config";
import { isGitRepository, getAllChanges } from "@core/git";
import {
  ReviewGenerator,
  parseReviewResponse,
  generatePrReviewMarkdown,
} from "@core/ai";
import type {
  ReviewConfig,
  ReviewSession,
  ReviewProgressPhase,
  Severity,
  ReviewCategory,
} from "@core/config";
import {
  PROGRESS_STEP_LABELS,
  VERSION,
  INITIAL_PROGRESS_PHASE,
  MIN_TERMINAL_COLUMNS,
  MIN_TERMINAL_ROWS,
} from "@core/config";
import { writeFileSync } from "fs";
import picomatch from "picomatch";

interface CliOptions {
  init?: boolean;
  all?: boolean;
  staged?: boolean;
  compareTo?: string;
  files?: string[];
  severity?: string;
  focus?: string[];
  output?: string;
  model?: string;
  maxDiffLength?: string;
  maxDiffTokens?: string;
  verbose?: boolean;
  yes?: boolean;
  chat?: boolean;
  importCollapse?: boolean;
}

async function validateGitRepo(): Promise<void> {
  const inside = await isGitRepository();
  if (!inside) {
    console.error(chalk.red("Error: Not a git repository"));
    process.exit(1);
  }
}

function progressStepToLabel(step: string): string {
  return PROGRESS_STEP_LABELS[step] ?? "reviewing code";
}

function reportError(error: unknown): void {
  if (error instanceof Error) {
    console.error(chalk.red(`Error: ${error.message}`));
  } else {
    console.error(chalk.red("An unexpected error occurred"));
  }
}

function applyOptionOverrides(options: CliOptions, config: ReviewConfig): void {
  if (options.severity) {
    const valid = ["critical", "warning", "info", "nitpick"];
    if (!valid.includes(options.severity)) {
      console.error(
        chalk.red(`Invalid severity. Must be one of: ${valid.join(", ")}`)
      );
      process.exit(1);
    }
    config.minSeverity = options.severity as Severity;
  }
  if (options.focus && options.focus.length > 0) {
    config.focusCategories = options.focus as ReviewCategory[];
  }
  if (options.output) {
    config.outputPath = options.output;
  }
  if (options.model) {
    config.model = options.model;
  }
  if (options.maxDiffLength !== undefined) {
    const n = Number(options.maxDiffLength);
    if (Number.isNaN(n) || n < 1) {
      console.error(
        chalk.red("Invalid max-diff-length. Must be a positive number.")
      );
      process.exit(1);
    }
    config.maxDiffLength = n;
  }
  if (options.maxDiffTokens !== undefined) {
    const n = Number(options.maxDiffTokens);
    if (Number.isNaN(n) || n < 1) {
      console.error(
        chalk.red("Invalid max-diff-tokens. Must be a positive number.")
      );
      process.exit(1);
    }
    config.maxDiffTokens = n;
  }
  if (options.importCollapse === false) {
    config.importCollapse = false;
  }
}

async function main(): Promise<void> {
  program
    .name("review-ai")
    .description(
      "AI-powered code review for uncommitted changes using GitHub Copilot"
    )
    .version(VERSION)
    .option("-a, --all", "Include all changes (staged + unstaged + untracked)")
    .option("--staged", "Review only staged changes")
    .option(
      "--compare-to <branch>",
      "Compare current branch to a base branch (e.g. main)"
    )
    .option(
      "--files <patterns...>",
      "Only review specific files (glob patterns)"
    )
    .option(
      "-s, --severity <level>",
      "Minimum severity: critical, warning, info, nitpick"
    )
    .option(
      "--focus <categories...>",
      "Focus on categories: bug, smell, architecture, performance, readability, security"
    )
    .option(
      "-o, --output <path>",
      "Output path for review report (default: ./PR-REVIEW.md)"
    )
    .option("--model <name>", "Override Copilot model")
    .option(
      "--max-diff-length <n>",
      "Max diff length in characters before truncation"
    )
    .option("--max-diff-tokens <n>", "Max diff size in estimated tokens")
    .option("--no-import-collapse", "Disable import line collapsing")
    .option("-v, --verbose", "Show verbose output")
    .option(
      "-y, --yes",
      "Skip file selection, review all changes non-interactively"
    )
    .option("--no-chat", "Skip interactive chat, generate report immediately")
    .option("--init", "Show config file template")
    .parse();

  const options = program.opts() as CliOptions;

  if (options.init) {
    console.log(chalk.cyan("Config template for ~/.review-ai.json:\n"));
    console.log(getConfigTemplate());
    process.exit(0);
  }

  await validateGitRepo();

  const config = loadConfig();
  applyOptionOverrides(options, config);

  const changes = await getAllChanges({
    stagedOnly: options.staged,
    compareTo: options.compareTo,
    ignoreWhitespace: config.ignoreWhitespaceInDiff,
  });

  if (changes.files.length === 0) {
    console.log(chalk.yellow("No uncommitted changes found."));
    process.exit(0);
  }

  // Filter by --files patterns if provided
  let filesToReview = changes.files;
  if (options.files && options.files.length > 0) {
    const patterns = options.files;
    const matchers = patterns.map((p) => picomatch(p));
    filesToReview = changes.files.filter((f) =>
      matchers.some((m) => m(f.path))
    );
    if (filesToReview.length === 0) {
      console.log(chalk.yellow("No files matching the provided patterns."));
      process.exit(0);
    }
  }

  if (options.verbose) {
    console.log(
      chalk.gray(
        `Found ${filesToReview.length} changed file(s) on branch ${changes.branch}`
      )
    );
    for (const f of filesToReview) {
      console.log(
        chalk.gray(
          `  ${f.status === "added" ? "+" : f.status === "deleted" ? "-" : "~"} ${f.path}${f.staged ? " (staged)" : ""}${f.binary ? " [binary]" : ""}`
        )
      );
    }
    console.log("");
  }

  const client = new CopilotClient({ logLevel: "error" });
  const generator = new ReviewGenerator(client);
  const progressRef = { current: INITIAL_PROGRESS_PHASE };

  let stopping = false;
  process.on("SIGINT", () => {
    if (stopping) return;
    stopping = true;
    generator.stop().then(() => process.exit(130));
  });

  const isNonInteractive = options.yes;

  try {
    if (isNonInteractive) {
      // Non-interactive mode
      const reviewableFiles = filesToReview.filter((f) => !f.binary);
      const combinedDiff = reviewableFiles
        .filter((f) => f.diff)
        .map((f) => f.diff)
        .join("\n");

      if (!combinedDiff) {
        console.log(chalk.yellow("No reviewable changes (only binary files)."));
        process.exit(0);
      }

      console.log(
        chalk.cyan(`Reviewing ${reviewableFiles.length} file(s)...\n`)
      );

      try {
        const rawResponse = await generator.review(
          combinedDiff,
          config,
          changes.branch,
          changes.stat,
          (chunk: string) => process.stdout.write(chunk),
          (phase: ReviewProgressPhase) => {
            progressRef.current = phase;
          }
        );

        console.log("\n");

        const issues = parseReviewResponse(rawResponse);

        // Build session for report
        const session: ReviewSession = {
          selectedFiles: reviewableFiles.map((f) => f.path),
          diff: combinedDiff,
          issues,
          chatHistory: [],
          branch: changes.branch,
          startedAt: Date.now(),
        };

        if (options.chat !== false) {
          // Chat mode not available in non-interactive, just generate report
        }

        const markdown = generatePrReviewMarkdown(session, config);
        writeFileSync(config.outputPath, markdown, "utf-8");
        console.log(chalk.green(`\nReport saved to ${config.outputPath}`));

        await generator.stop();
        process.exit(0);
      } catch (error) {
        console.error(
          chalk.gray(
            `Stopped after ${progressStepToLabel(progressRef.current)}.`
          )
        );
        reportError(error);
        await generator.stop();
        process.exit(1);
      }
    } else {
      // Interactive mode
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        console.error(
          chalk.yellow(
            "Interactive mode requires a TTY. Run with --yes for non-interactive mode."
          )
        );
        process.exit(1);
      }

      const cols = process.stdout.columns ?? 0;
      const terminalRows = process.stdout.rows ?? 0;
      if (cols < MIN_TERMINAL_COLUMNS || terminalRows < MIN_TERMINAL_ROWS) {
        console.error(
          chalk.yellow(
            `Terminal too small. Please resize to at least ${MIN_TERMINAL_COLUMNS}x${MIN_TERMINAL_ROWS}.`
          )
        );
        process.exit(1);
      }

      try {
        const { render } = await import("ink");
        const React = (await import("react")).default;
        const { Dashboard } = await import("@ui/features/dashboard");
        const { ErrorBoundary } = await import("@ui/components/ErrorBoundary");
        const { ReviewProvider } = await import("@ui/context/ReviewContext");

        const initialSession: ReviewSession = {
          selectedFiles: [],
          diff: "",
          issues: [],
          chatHistory: [],
          branch: changes.branch,
          startedAt: Date.now(),
        };

        const dashboardProps = {
          gitFiles: filesToReview,
          version: VERSION,
          onComplete: () => {
            process.exit(0);
          },
          onError: (error: Error) => {
            generator.stop().then(() => {
              console.error(
                chalk.gray(
                  `Stopped after ${progressStepToLabel(progressRef.current)}.`
                )
              );
              reportError(error);
              process.exit(1);
            });
          },
        };

        const { waitUntilExit } = render(
          React.createElement(ErrorBoundary, {
            onError: (error: Error) => {
              generator.stop().then(() => {
                reportError(error);
                process.exit(1);
              });
            },
            children: React.createElement(ReviewProvider, {
              config,
              generator,
              initialSession,
              children: React.createElement(Dashboard, dashboardProps),
            }),
          })
        );

        await waitUntilExit();
      } catch (error) {
        console.error(
          chalk.gray(
            `Stopped after ${progressStepToLabel(progressRef.current)}.`
          )
        );
        reportError(error);
        await generator.stop();
        process.exit(1);
      }
    }
  } finally {
    await generator.stop();
  }
}

main().catch((error: unknown) => {
  reportError(error);
  process.exit(1);
});
