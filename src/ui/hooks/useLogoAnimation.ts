import { useAnimationFrame } from "./useClock.js";

const COLOR_CYCLE_MS = 300;

export function useLogoAnimation(): number {
  const time = useAnimationFrame(COLOR_CYCLE_MS);
  return Math.floor(time / COLOR_CYCLE_MS);
}
