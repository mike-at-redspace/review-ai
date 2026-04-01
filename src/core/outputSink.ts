import chalk from "chalk";
import type {
  OutputSink,
  ReviewIssue,
  ReviewProgressPhase,
  ReviewSession,
  Severity,
} from "@core/config";
import { PROGRESS_STEP_LABELS } from "@core/config";
import { parseToolFilePath } from "@core/ai";

const SEVERITY_STYLES: Record<Severity, (text: string) => string> = {
  critical: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  nitpick: chalk.gray,
};

export class HumanSink implements OutputSink {
  private toolCallCount = 0;

  progress(phase: ReviewProgressPhase) {
    const label = PROGRESS_STEP_LABELS[phase] ?? phase;
    process.stderr.write(chalk.gray(`  ${label}...\r`));
  }

  toolCall(toolName: string, args?: string) {
    this.toolCallCount++;
    const file = parseToolFilePath(args) ?? toolName;
    process.stderr.write(
      chalk.cyan(`  reading ${file} (file ${this.toolCallCount})...\r`)
    );
  }

  chunk(text: string) {
    process.stdout.write(text);
  }

  issue({ severity, title }: ReviewIssue) {
    const style = SEVERITY_STYLES[severity] ?? chalk.white;
    console.log(style(`  [${severity.toUpperCase()}] ${title}`));
  }

  summary({ issues, selectedFiles }: ReviewSession) {
    const active = issues.filter((i) => !i.ignored).length;
    console.log(
      chalk.cyan(
        `\n${active} issue(s) found across ${selectedFiles.length} file(s)`
      )
    );
  }

  error(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Error: ${message}`));
  }
}

export class JsonSink implements OutputSink {
  private emit(obj: Record<string, unknown>) {
    process.stdout.write(JSON.stringify(obj) + "\n");
  }

  progress(phase: ReviewProgressPhase) {
    this.emit({ type: "progress", phase });
  }

  toolCall(toolName: string, args?: string) {
    this.emit({ type: "tool_call", tool: toolName, args });
  }

  chunk(text: string) {
    this.emit({ type: "chunk", text });
  }

  issue(issue: ReviewIssue) {
    this.emit({ type: "issue", ...issue });
  }

  summary({ issues, selectedFiles, branch }: ReviewSession) {
    this.emit({
      type: "summary",
      totalIssues: issues.length,
      activeIssues: issues.filter((i) => !i.ignored).length,
      files: selectedFiles,
      branch,
    });
  }

  error(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    this.emit({ type: "error", message });
  }
}

export const createSink = (json: boolean): OutputSink =>
  json ? new JsonSink() : new HumanSink();
