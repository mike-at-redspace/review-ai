import { createStore, useStore } from "./store.js";

interface ToolCallInfo {
  toolName: string;
  filePath?: string;
  /** Running count of tool calls in this review (1-indexed). */
  callNumber: number;
}

interface StreamState {
  text: string;
  isStreaming: boolean;
  activeToolCall?: ToolCallInfo;
  /** All files explored so far in this review. */
  exploredFiles: string[];
  toolCallCount: number;
}

export const streamStore = createStore<StreamState>({
  text: "",
  isStreaming: false,
  exploredFiles: [],
  toolCallCount: 0,
});

export function appendChunk(chunk: string): void {
  streamStore.setState((s) => ({ ...s, text: s.text + chunk }));
}

export function startStream(): void {
  streamStore.setState(() => ({
    text: "",
    isStreaming: true,
    activeToolCall: undefined,
    exploredFiles: [],
    toolCallCount: 0,
  }));
}

export function finishStream(): void {
  streamStore.setState((s) => ({
    ...s,
    isStreaming: false,
    activeToolCall: undefined,
  }));
}

export function setToolCall(toolName: string, filePath?: string): void {
  streamStore.setState((s) => {
    const callNumber = s.toolCallCount + 1;
    const label = filePath ?? toolName;
    return {
      ...s,
      toolCallCount: callNumber,
      activeToolCall: { toolName, filePath, callNumber },
      exploredFiles: [...s.exploredFiles, label],
    };
  });
}

export function clearToolCall(): void {
  streamStore.setState((s) => ({ ...s, activeToolCall: undefined }));
}

const selectText = (s: StreamState) => s.text;
const selectIsStreaming = (s: StreamState) => s.isStreaming;
const selectToolCall = (s: StreamState) => s.activeToolCall;
const selectExploredFiles = (s: StreamState) => s.exploredFiles;

export function useStreamText(): string {
  return useStore(streamStore, selectText);
}

export function useIsStreaming(): boolean {
  return useStore(streamStore, selectIsStreaming);
}

export function useActiveToolCall(): ToolCallInfo | undefined {
  return useStore(streamStore, selectToolCall);
}

export function useExploredFiles(): string[] {
  return useStore(streamStore, selectExploredFiles);
}
