import { createStore, useStore } from "./store.js";

export interface ToolCallInfo {
  toolName: string;
  filePath?: string;
  /** Running count of tool calls in this review (1-indexed). */
  callNumber: number;
}

interface StreamState {
  text: string;
  isStreaming: boolean;
  activeToolCall?: ToolCallInfo;
  exploredFiles: string[];
  toolCallCount: number;
}

const INITIAL_STATE: StreamState = {
  text: "",
  isStreaming: false,
  exploredFiles: [],
  toolCallCount: 0,
};

export const streamStore = createStore<StreamState>({ ...INITIAL_STATE });

// --- Actions ---

export const appendChunk = (chunk: string) =>
  streamStore.setState((s) => ({ ...s, text: s.text + chunk }));

export const startStream = () =>
  streamStore.setState(() => ({ ...INITIAL_STATE, isStreaming: true }));

export const finishStream = () =>
  streamStore.setState((s) => ({
    ...s,
    isStreaming: false,
    activeToolCall: undefined,
  }));

export const setToolCall = (toolName: string, filePath?: string) =>
  streamStore.setState((s) => {
    const callNumber = s.toolCallCount + 1;
    return {
      ...s,
      toolCallCount: callNumber,
      activeToolCall: { toolName, filePath, callNumber },
      exploredFiles: [...s.exploredFiles, filePath ?? toolName],
    };
  });

export const clearToolCall = () =>
  streamStore.setState((s) => ({ ...s, activeToolCall: undefined }));

// --- Selectors ---

export const useStreamText = () => useStore(streamStore, (s) => s.text);
export const useIsStreaming = () => useStore(streamStore, (s) => s.isStreaming);
export const useActiveToolCall = () =>
  useStore(streamStore, (s) => s.activeToolCall);
export const useExploredFiles = () =>
  useStore(streamStore, (s) => s.exploredFiles);
