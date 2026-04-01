import React, { createContext, useContext, useEffect, useState } from "react";

export type Clock = {
  subscribe: (onChange: () => void, keepAlive: boolean) => () => void;
  now: () => number;
};

const TICK_MS = 80;

export function createClock(): Clock {
  const subscribers = new Map<() => void, boolean>();
  let interval: ReturnType<typeof setInterval> | null = null;
  let startTime = 0;
  let tickTime = 0;

  function tick(): void {
    tickTime = Date.now() - startTime;
    for (const onChange of subscribers.keys()) {
      onChange();
    }
  }

  function updateInterval(): void {
    const anyKeepAlive = [...subscribers.values()].some(Boolean);
    if (anyKeepAlive) {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      if (startTime === 0) {
        startTime = Date.now();
      }
      interval = setInterval(tick, TICK_MS);
    } else if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  return {
    subscribe(onChange, keepAlive) {
      subscribers.set(onChange, keepAlive);
      updateInterval();
      return () => {
        subscribers.delete(onChange);
        updateInterval();
      };
    },
    now() {
      if (startTime === 0) {
        startTime = Date.now();
      }
      if (interval && tickTime) {
        return tickTime;
      }
      return Date.now() - startTime;
    },
  };
}

export const ClockContext = createContext<Clock | null>(null);

export function ClockProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const [clock] = useState(() => createClock());
  return React.createElement(ClockContext.Provider, { value: clock }, children);
}

/**
 * Subscribe to the shared animation clock.
 * Only the component calling this hook re-renders on tick.
 * Pass null to pause (unsubscribe).
 */
export function useAnimationFrame(intervalMs: number | null = 80): number {
  const clock = useContext(ClockContext);
  const [time, setTime] = useState(() => clock?.now() ?? 0);

  useEffect(() => {
    if (!clock || intervalMs === null) return;

    let lastUpdate = clock.now();

    const onChange = (): void => {
      const now = clock.now();
      if (now - lastUpdate >= intervalMs) {
        lastUpdate = now;
        setTime(now);
      }
    };

    return clock.subscribe(onChange, true);
  }, [clock, intervalMs]);

  return time;
}
