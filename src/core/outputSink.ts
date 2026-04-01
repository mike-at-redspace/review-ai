import chalk from "chalk";
import type {
  OutputSink,
  ReviewIssue,
  ReviewProgressPhase,
  ReviewSession,
  Severity,
} from "@core/config";
import { PROGRESS_STEP_LABELS } from "@core/config";

const SEVERITY_STYLES: Record<Severity, (text: string) => string> = {
  critical: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  nitpick: chalk.gray,
};

export class HumanSink implements OutputSink {
  private toolCallCount = 0;

  progress(phase: ReviewProgressPhase): void {
    const label = PROGRESS_STEP_LABELS[phase] ?? phase;
    process.stderr.write(chalk.gray(`  ${label}...\r`));
  }

  toolCall(_toolName: string, args?: string): void {
    this.toolCallCount++;
    let filePath = _toolName;
    if (args) {
      try {
        const parsed = JSON.parse(args);
        filePath = parsed.file_path ?? parsed.path ?? _toolName;
      } catch {
        filePath = args;
      }
    }
    process.stderr.write(
      chalk.cyan(`  reading ${filePath} (file ${this.toolCallCount})...\r`)
    );
  }

  chunk(text: string): void {
    process.stdout.write(text);
  }

  issue(issue: ReviewIssue): void {
    const style = SEVERITY_STYLES[issue.severity] ?? chalk.white;
    console.log(style(`  [${issue.severity.toUpperCase()}] ${issue.title}`));
  }

  summary(session: ReviewSession): void {
    const active = session.issues.filter((i) => !i.ignored);
    console.log(
      chalk.cyan(
        `\n${active.length} issue(s) found across ${session.selectedFiles.length} file(s)`
      )
    );
  }

  error(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Error: ${message}`));
  }
}

export class JsonSink implements OutputSink {
  private write(obj: Record<string, unknown>): void {
    process.stdout.write(JSON.stringify(obj) + "\n");
  }

  progress(phase: ReviewProgressPhase): void {
    this.write({ type: "progress", phase });
  }

  toolCall(toolName: string, args?: string): void {
    this.write({ type: "tool_call", tool: toolName, args });
  }

  chunk(text: string): void {
    this.write({ type: "chunk", text });
  }

  issue(issue: ReviewIssue): void {
    this.write({ type: "issue", ...issue });
  }

  summary(session: ReviewSession): void {
    this.write({
      type: "summary",
      totalIssues: session.issues.length,
      activeIssues: session.issues.filter((i) => !i.ignored).length,
      files: session.selectedFiles,
      branch: session.branch,
    });
  }

  error(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.write({ type: "error", message });
  }
}

export function createSink(json: boolean): OutputSink {
  return json ? new JsonSink() : new HumanSink();
}
