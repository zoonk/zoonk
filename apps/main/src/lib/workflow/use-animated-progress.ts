"use client";

import { useEffect, useRef, useState } from "react";

const MAX_DRIFT = 20;
const HALF_LIFE = 15_000;
const CAP = 97;

/**
 * Wraps a real progress value and slowly ticks it forward
 * while streaming is active, creating the illusion of movement
 * during long-running backend steps.
 */
export function useAnimatedProgress(realProgress: number, active: boolean): number {
  const [display, setDisplay] = useState(realProgress);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const baseRef = useRef(realProgress);

  // Reset the drift timer whenever realProgress changes
  useEffect(() => {
    baseRef.current = realProgress;
    startTimeRef.current = performance.now();
  }, [realProgress]);

  useEffect(() => {
    if (!active) {
      setDisplay(realProgress);
      cancelAnimationFrame(rafRef.current);
      return;
    }

    function tick() {
      const elapsed = performance.now() - startTimeRef.current;
      const drift = MAX_DRIFT * (1 - 1 / (1 + elapsed / HALF_LIFE));
      const animated = baseRef.current + drift;
      const capped = Math.min(animated, CAP);
      const final = Math.max(capped, baseRef.current);

      setDisplay((prev) => {
        const rounded = Math.floor(final);
        return rounded === Math.floor(prev) ? prev : rounded;
      });

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [active, realProgress]);

  return display;
}
