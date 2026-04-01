import { useCallback } from "react";
import type { ReviewConfig, ReviewSession, ViewState } from "@core/config";
import { generatePrReviewMarkdown } from "@core/ai";
import { writeFileSync } from "fs";

interface UseReportWriterOptions {
  session: ReviewSession;
  config: ReviewConfig;
  onComplete: () => void;
  setViewState: React.Dispatch<React.SetStateAction<ViewState>>;
}

export function useReportWriter({
  session,
  config,
  onComplete,
  setViewState,
}: UseReportWriterOptions) {
  const handleDone = useCallback(() => {
    setViewState({ type: "generating-report" });
    try {
      const markdown = generatePrReviewMarkdown(session, config);
      writeFileSync(config.outputPath, markdown, "utf-8");
      setViewState({ type: "done", outputPath: config.outputPath });
      setTimeout(onComplete, 1500);
    } catch (err) {
      setViewState({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to write report",
      });
    }
  }, [session, config, onComplete, setViewState]);

  return { handleDone };
}
