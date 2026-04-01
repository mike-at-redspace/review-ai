import { useState, useCallback } from "react";

export function useScrollableList(itemCount: number) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const moveUp = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : itemCount - 1));
  }, [itemCount]);

  const moveDown = useCallback(() => {
    setSelectedIndex((prev) => (prev < itemCount - 1 ? prev + 1 : 0));
  }, [itemCount]);

  return { selectedIndex, setSelectedIndex, moveUp, moveDown };
}
