import { useLayoutEffect, useRef } from "react";

/**
 * A gate that lifts by itself, with no tap, leaves its slot as tall as it was for the rest of the
 * visit, so what's below doesn't move under the learner's finger; what replaces it sits at the top.
 * The next visit takes the natural height.
 */
export function useHeldSlot<Slot extends HTMLElement>(gated: boolean) {
  const slot = useRef<Slot>(null);
  const gateHeight = useRef<number | null>(null);

  useLayoutEffect(() => {
    const element = slot.current;

    if (!element) {
      return;
    }

    if (!gated) {
      if (gateHeight.current !== null) {
        element.dataset.held = "";
        element.style.minHeight = `${gateHeight.current}px`;
      }

      return;
    }

    // The tallest it has been: its line can go a moment before the gate does, at the same instant.
    const measure = () => {
      gateHeight.current = Math.max(
        gateHeight.current ?? 0,
        element.getBoundingClientRect().height,
      );
    };

    measure();
    const observer = new ResizeObserver(measure);

    observer.observe(element);
    return () => observer.disconnect();
  }, [gated]);

  return slot;
}
