import { useCallback, useSyncExternalStore } from "react";

export interface Store<T> {
  getState: () => T;
  setState: (updater: (prev: T) => T) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    getState() {
      return state;
    },
    setState(updater) {
      const next = updater(state);
      if (!Object.is(state, next)) {
        state = next;
        for (const listener of listeners) {
          listener();
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useStore<T, S>(store: Store<T>, selector: (state: T) => S): S {
  const getSnapshot = useCallback(
    () => selector(store.getState()),
    [store, selector]
  );
  return useSyncExternalStore(store.subscribe, getSnapshot);
}
