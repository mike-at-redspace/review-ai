import { CopilotClient, approveAll } from "@github/copilot-sdk";
import type { ReviewConfig, ReviewProgressPhase } from "@core/config";
import { COPILOT_SESSION_TIMEOUT } from "@core/config";
import {
  REVIEW_SYSTEM_PROMPT,
  buildReviewPrompt,
  getEffectiveDiffLimit,
} from "./prompt.js";
import { getSmartDiff } from "@core/git";

export class ReviewGenerator {
  private session: Awaited<ReturnType<CopilotClient["createSession"]>> | null =
    null;

  constructor(private client: CopilotClient) {}

  async review(
    diff: string,
    config: ReviewConfig,
    branch: string,
    stat?: string,
    onChunk?: (chunk: string) => void,
    onProgress?: (phase: ReviewProgressPhase) => void
  ): Promise<string> {
    const effectiveLimit = getEffectiveDiffLimit(config);
    let wasTruncated = false;
    let content = diff;

    if (diff.length > effectiveLimit) {
      const result = getSmartDiff(diff, stat, config, effectiveLimit);
      content = result.content;
      wasTruncated = result.wasTruncated;
    }

    const prompt = buildReviewPrompt(
      content,
      config,
      branch,
      stat,
      wasTruncated
    );

    onProgress?.("session");
    this.session = await this.client.createSession({
      model: config.model,
      streaming: true,
      onPermissionRequest: approveAll,
      systemMessage: {
        mode: "replace",
        content: REVIEW_SYSTEM_PROMPT,
      },
    });

    return this.runWithSession(this.session, prompt, onChunk, onProgress);
  }

  async followUp(
    prompt: string,
    onChunk?: (chunk: string) => void,
    onProgress?: (phase: ReviewProgressPhase) => void
  ): Promise<string> {
    if (!this.session) {
      throw new Error("No active review session. Call review() first.");
    }
    return this.runWithSession(this.session, prompt, onChunk, onProgress);
  }

  private async runWithSession(
    session: Awaited<ReturnType<CopilotClient["createSession"]>>,
    prompt: string,
    onChunk?: (chunk: string) => void,
    onProgress?: (phase: ReviewProgressPhase) => void
  ): Promise<string> {
    let fullRawMessage = "";
    let hasReportedStreaming = false;

    const done = new Promise<void>((resolve) => {
      session.on((event: { type: string; data?: unknown }) => {
        const data = event.data as
          | { deltaContent?: string; content?: string }
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
        } else if (event.type === "session.idle") {
          resolve();
        }
      });
    });

    onProgress?.("sending");
    await session.send({ prompt });
    await Promise.race([
      done,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Session timeout")),
          COPILOT_SESSION_TIMEOUT
        )
      ),
    ]);

    const rawMessage = fullRawMessage.trim();
    if (!rawMessage) {
      throw new Error("No response received from Copilot");
    }
    return rawMessage;
  }

  async stop(): Promise<void> {
    try {
      if (this.session) {
        await this.session.destroy();
        this.session = null;
      }
      await Promise.race([
        this.client.stop(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Stop timeout")), 1000)
        ),
      ]);
    } catch {
      // Ignore errors during stop
    }
  }
}
