import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import type {
  ChatMessage,
  ReviewConfig,
  ReviewIssue,
  ReviewSession,
} from "@core/config";
import type { ReviewGenerator } from "@core/ai";

export interface ReviewContextValue {
  config: ReviewConfig;
  generator: ReviewGenerator;
  session: ReviewSession;
  updateSession: (patch: Partial<ReviewSession>) => void;
  addIssue: (issue: Omit<ReviewIssue, "id" | "ignored">) => void;
  ignoreIssue: (id: number) => void;
  addChatMessage: (msg: Omit<ChatMessage, "timestamp">) => void;
}

const ReviewCtx = createContext<ReviewContextValue | null>(null);

export interface ReviewProviderProps {
  config: ReviewConfig;
  generator: ReviewGenerator;
  initialSession: ReviewSession;
  children: ReactNode;
}

export function ReviewProvider({
  config,
  generator,
  initialSession,
  children,
}: ReviewProviderProps): React.ReactElement {
  const [session, setSession] = useState<ReviewSession>(initialSession);

  const updateSession = useCallback((patch: Partial<ReviewSession>) => {
    setSession((prev) => ({ ...prev, ...patch }));
  }, []);

  const addIssue = useCallback((issue: Omit<ReviewIssue, "id" | "ignored">) => {
    setSession((prev) => {
      const maxId = prev.issues.reduce((max, i) => Math.max(max, i.id), 0);
      return {
        ...prev,
        issues: [...prev.issues, { ...issue, id: maxId + 1, ignored: false }],
      };
    });
  }, []);

  const ignoreIssue = useCallback((id: number) => {
    setSession((prev) => ({
      ...prev,
      issues: prev.issues.map((i) =>
        i.id === id ? { ...i, ignored: !i.ignored } : i
      ),
    }));
  }, []);

  const addChatMessage = useCallback((msg: Omit<ChatMessage, "timestamp">) => {
    setSession((prev) => ({
      ...prev,
      chatHistory: [...prev.chatHistory, { ...msg, timestamp: Date.now() }],
    }));
  }, []);

  const value: ReviewContextValue = {
    config,
    generator,
    session,
    updateSession,
    addIssue,
    ignoreIssue,
    addChatMessage,
  };

  return <ReviewCtx.Provider value={value}>{children}</ReviewCtx.Provider>;
}

export function useReviewContext(): ReviewContextValue {
  const value = useContext(ReviewCtx);
  if (value === null) {
    throw new Error("useReviewContext must be used within ReviewProvider");
  }
  return value;
}
