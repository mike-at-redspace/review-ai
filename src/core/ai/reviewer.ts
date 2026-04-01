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

export interface ReviewGeneratorOptions {
  /** Git repo root; Copilot tool paths resolve relative to this directory. */
  workingDirectory?: string;
}

export class ReviewGenerator {
  private session: Awaited<ReturnType<CopilotClient["createSession"]>> | null =
    null;
  public selectedModel: string | null = null;

  constructor(
    private client: CopilotClient,
    private readonly generatorOptions: ReviewGeneratorOptions = {}
  ) {}

  async review(
    diff: string,
    config: ReviewConfig,
    branch: string,
    stat?: string,
    onChunk?: (chunk: string) => void,
    onProgress?: (phase: ReviewProgressPhase) => void,
    onToolCall?: (toolName: string, args?: string) => void,
    onToolComplete?: () => void
  ): Promise<string> {
    const effectiveLimit = getEffectiveDiffLimit(config);
    let wasTruncated = false;
    let content = diff;

    if (diff.length > effectiveLimit) {
      const result = getSmartDiff(diff, stat, config, effectiveLimit);
      content = result.content;
      wasTruncated = result.wasTruncated;
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

    onProgress?.("session");
    this.session = await this.client.createSession({
      clientName: "review-ai",
      model,
      streaming: true,
      onPermissionRequest: approveAll,
      systemMessage: {
        mode: "replace",
        content: buildSystemPrompt(config),
      },
      ...(this.generatorOptions.workingDirectory
        ? { workingDirectory: this.generatorOptions.workingDirectory }
        : {}),
    });

    return this.runWithSession(
      this.session,
      prompt,
      onChunk,
      onProgress,
      onToolCall,
      onToolComplete
    );
  }

  async followUp(
    prompt: string,
    onChunk?: (chunk: string) => void,
    onProgress?: (phase: ReviewProgressPhase) => void,
    onToolCall?: (toolName: string, args?: string) => void,
    onToolComplete?: () => void
  ): Promise<string> {
    if (!this.session) {
      throw new Error("No active review session. Call review() first.");
    }
    return this.runWithSession(
      this.session,
      prompt,
      onChunk,
      onProgress,
      onToolCall,
      onToolComplete
    );
  }

  private async runWithSession(
    session: Awaited<ReturnType<CopilotClient["createSession"]>>,
    prompt: string,
    onChunk?: (chunk: string) => void,
    onProgress?: (phase: ReviewProgressPhase) => void,
    onToolCall?: (toolName: string, args?: string) => void,
    onToolComplete?: () => void
  ): Promise<string> {
    let fullRawMessage = "";
    let hasReportedStreaming = false;

    const unsubscribe = session.on((event) => {
      const data = event.data as
        | {
            deltaContent?: string;
            content?: string;
            toolName?: string;
            arguments?: string;
          }
        | undefined;
      if (event.type === "assistant.message_delta" && data?.deltaContent) {
        if (!hasReportedStreaming) {
          hasReportedStreaming = true;
          onProgress?.("streaming");
        }
        const chunk = data.deltaContent;
        fullRawMessage += chunk;
        onChunk?.(chunk);
      } else if (event.type === "assistant.message" && data?.content) {
        if (!fullRawMessage) {
          fullRawMessage = data.content;
        }
      } else if (event.type === "tool.execution_start" && data?.toolName) {
        onProgress?.("exploring");
        let toolArgs: string | undefined;
        try {
          toolArgs =
            data.arguments === undefined
              ? undefined
              : typeof data.arguments === "string"
                ? data.arguments
                : JSON.stringify(data.arguments);
        } catch {
          toolArgs = String(data.arguments);
        }
        onToolCall?.(data.toolName, toolArgs);
        // Reset so we re-report streaming when text generation resumes
        hasReportedStreaming = false;
      } else if (event.type === "tool.execution_complete") {
        onToolComplete?.();
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
    if (!rawMessage) {
      throw new Error("No response received from Copilot");
    }
    return rawMessage;
  }

  /**
   * Disconnects the Copilot session and stops the client. Returns cleanup errors
   * (e.g. from {@link CopilotClient.stop}); empty if everything succeeded.
   */
  async stop(): Promise<Error[]> {
    const errors: Error[] = [];
    try {
      if (this.session) {
        try {
          await this.session.disconnect();
        } catch (e) {
          errors.push(e instanceof Error ? e : new Error(String(e)));
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
        errors.push(e instanceof Error ? e : new Error(String(e)));
      }
    } catch (e) {
      errors.push(e instanceof Error ? e : new Error(String(e)));
    }
    return errors;
  }
}
