import { useState, useEffect } from "react";
import { LOGO_ANIMATION_INTERVAL_MS } from "@core/config";

export function useLogoAnimation(
  intervalMs: number = LOGO_ANIMATION_INTERVAL_MS
): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return tick;
}
