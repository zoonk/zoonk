import { useLayoutEffect, useRef } from "react";

/**
 * A gate that lifts by itself, with no tap, leaves its slot as tall as it was for the rest of the
 * visit, so what's below doesn't move under the learner's finger; what replaces it sits at the top.
 * The next visit takes the natural height.
 */
export function useHeldSlot<Slot extends HTMLElement>(gated: boolean) {
  const slot = useRef<Slot>(null);
  const gate = useRef<{ height: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const element = slot.current;

    if (!element) {
      return;
    }

    if (!gated) {
      if (gate.current) {
        element.dataset.held = "";
        element.style.minHeight = `${gate.current.height}px`;
      }

      return;
    }

    // The tallest it has been at this width: its line can go a moment before the gate does.
    const measure = () => {
      const { height, width } = element.getBoundingClientRect();
      const kept = gate.current?.width === width ? gate.current.height : 0;
      gate.current = { height: Math.max(kept, height), width };
    };

    measure();
    const observer = new ResizeObserver(measure);

    observer.observe(element);
    return () => observer.disconnect();
  }, [gated]);

  return slot;
}
