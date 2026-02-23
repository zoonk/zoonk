"use client";

import { useEffect, useRef, useState } from "react";

const MAX_DRIFT = 8;
const HALF_LIFE = 15_000;
const CAP = 97;

/**
 * Wraps a real progress value and slowly ticks it forward
 * while streaming is active, creating the illusion of movement
 * during long-running backend steps.
 *
 * Uses a high-water mark to ensure the displayed value never decreases,
 * preventing visual "snap-back" when real progress drops after drift inflation.
 */
export function useAnimatedProgress(realProgress: number, active: boolean): number {
  const [display, setDisplay] = useState(realProgress);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const baseRef = useRef(realProgress);
  const highWaterRef = useRef(realProgress);

  // Only reset the drift timer when realProgress exceeds the high-water mark
  useEffect(() => {
    baseRef.current = realProgress;

    if (realProgress > highWaterRef.current) {
      highWaterRef.current = realProgress;
      startTimeRef.current = performance.now();
    }
  }, [realProgress]);

  useEffect(() => {
    if (!active) {
      setDisplay(realProgress);
      highWaterRef.current = realProgress;
      cancelAnimationFrame(rafRef.current);
      return;
    }

    function tick() {
      const elapsed = performance.now() - startTimeRef.current;
      const drift = MAX_DRIFT * (1 - 1 / (1 + elapsed / HALF_LIFE));
      const animated = baseRef.current + drift;
      const capped = Math.min(animated, CAP);
      const monotonic = Math.max(capped, highWaterRef.current);

      highWaterRef.current = monotonic;

      setDisplay((prev) => {
        const rounded = Math.floor(monotonic);
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
