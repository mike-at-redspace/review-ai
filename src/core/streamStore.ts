import { createStore, useStore } from "./store.js";

interface StreamState {
  text: string;
  isStreaming: boolean;
}

export const streamStore = createStore<StreamState>({
  text: "",
  isStreaming: false,
});

export function appendChunk(chunk: string): void {
  streamStore.setState((s) => ({ ...s, text: s.text + chunk }));
}

export function startStream(): void {
  streamStore.setState(() => ({ text: "", isStreaming: true }));
}

export function finishStream(): void {
  streamStore.setState((s) => ({ ...s, isStreaming: false }));
}

const selectText = (s: StreamState) => s.text;
const selectIsStreaming = (s: StreamState) => s.isStreaming;

export function useStreamText(): string {
  return useStore(streamStore, selectText);
}

export function useIsStreaming(): boolean {
  return useStore(streamStore, selectIsStreaming);
}
