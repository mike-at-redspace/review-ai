import { useEffect } from "react";

export function useRunOnceOnMount(fn: () => void): void {
  useEffect(() => {
    fn();
  }, []);
}
