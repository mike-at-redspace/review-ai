import { approveAll, CopilotClient } from "@github/copilot-sdk";
import type { ReviewConfig, ReviewProgressPhase } from "@core/config";
import {
  COPILOT_CLIENT_STOP_TIMEOUT_MS,
  COPILOT_SESSION_TIMEOUT,
  MAX_REPO_MAP_FILES,
} from "@core/config";
import {
  buildReviewPrompt,
  buildSystemPrompt,
  getEffectiveDiffLimit,
} from "./prompt.js";
import { selectModel } from "./modelSelector.js";
import { getSmartDiff, getRepositoryFileList } from "@core/git";

export interface ReviewCallbacks {
  onChunk?: (chunk: string) => void;
  onProgress?: (phase: ReviewProgressPhase) => void;
  onToolCall?: (toolName: string, args?: string) => void;
  onToolComplete?: () => void;
}

export interface ReviewGeneratorOptions {
  /** Git repo root; Copilot tool paths resolve relative to this directory. */
  workingDirectory?: string;
}

/** Safely coerce SDK tool arguments to a string (or undefined). */
function stringifyArgs(args: unknown): string | undefined {
  if (args === undefined) return undefined;
  if (typeof args === "string") return args;
  try {
    return JSON.stringify(args);
  } catch {
    return String(args);
  }
}

type Session = Awaited<ReturnType<CopilotClient["createSession"]>>;

export class ReviewGenerator {
  private session: Session | null = null;
  public selectedModel: string | null = null;

  constructor(
    private client: CopilotClient,
    private readonly options: ReviewGeneratorOptions = {}
  ) {}

  async review(
    diff: string,
    config: ReviewConfig,
    branch: string,
    stat?: string,
    callbacks: ReviewCallbacks = {}
  ): Promise<string> {
    const effectiveLimit = getEffectiveDiffLimit(config);
    let wasTruncated = false;
    let content = diff;

    if (diff.length > effectiveLimit) {
      const result = getSmartDiff(diff, stat, config, effectiveLimit);
      ({ content, wasTruncated } = result);
    }

    const repoFiles =
      config.includeRepoMap !== false
        ? await getRepositoryFileList(MAX_REPO_MAP_FILES)
        : [];

    const prompt = buildReviewPrompt(
      content,
      config,
      branch,
      stat,
      wasTruncated,
      repoFiles
    );

    const model = selectModel(content, config);
    this.selectedModel = model;

    callbacks.onProgress?.("session");
    this.session = await this.client.createSession({
      clientName: "review-ai",
      model,
      streaming: true,
      onPermissionRequest: approveAll,
      systemMessage: { mode: "replace", content: buildSystemPrompt(config) },
      ...(this.options.workingDirectory
        ? { workingDirectory: this.options.workingDirectory }
        : {}),
    });

    return this.runWithSession(this.session, prompt, callbacks);
  }

  async followUp(
    prompt: string,
    callbacks: ReviewCallbacks = {}
  ): Promise<string> {
    if (!this.session) {
      throw new Error("No active review session. Call review() first.");
    }
    return this.runWithSession(this.session, prompt, callbacks);
  }

  private async runWithSession(
    session: Session,
    prompt: string,
    { onChunk, onProgress, onToolCall, onToolComplete }: ReviewCallbacks
  ): Promise<string> {
    let fullRawMessage = "";
    let hasReportedStreaming = false;

    const unsubscribe = session.on((event) => {
      const { type, data } = event as {
        type: string;
        data?: Record<string, unknown>;
      };

      switch (type) {
        case "assistant.message_delta": {
          const delta = data?.deltaContent as string | undefined;
          if (!delta) break;
          if (!hasReportedStreaming) {
            hasReportedStreaming = true;
            onProgress?.("streaming");
          }
          fullRawMessage += delta;
          onChunk?.(delta);
          break;
        }
        case "assistant.message":
          if (!fullRawMessage && data?.content) {
            fullRawMessage = data.content as string;
          }
          break;
        case "tool.execution_start":
          if (!data?.toolName) break;
          onProgress?.("exploring");
          onToolCall?.(data.toolName as string, stringifyArgs(data.arguments));
          hasReportedStreaming = false; // re-report when text resumes
          break;
        case "tool.execution_complete":
          onToolComplete?.();
          break;
      }
    });

    try {
      onProgress?.("sending");
      const finalEvent = await session.sendAndWait(
        { prompt },
        COPILOT_SESSION_TIMEOUT
      );
      if (!fullRawMessage.trim() && finalEvent?.data?.content) {
        fullRawMessage = finalEvent.data.content;
      }
    } finally {
      unsubscribe();
    }

    const rawMessage = fullRawMessage.trim();
    if (!rawMessage) throw new Error("No response received from Copilot");
    return rawMessage;
  }

  /** Disconnect session and stop client. Returns any cleanup errors. */
  async stop(): Promise<Error[]> {
    const errors: Error[] = [];
    const collect = (e: unknown) =>
      errors.push(e instanceof Error ? e : new Error(String(e)));

    if (this.session) {
      try {
        await this.session.disconnect();
      } catch (e) {
        collect(e);
      }
      this.session = null;
    }

    try {
      const stopErrors = await Promise.race([
        this.client.stop(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Stop timeout")),
            COPILOT_CLIENT_STOP_TIMEOUT_MS
          )
        ),
      ]);
      errors.push(...stopErrors);
    } catch (e) {
      collect(e);
    }

    return errors;
  }
}
