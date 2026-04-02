"use client";

import { useEffect, useRef, useState } from "react";

const HALF_LIFE = 12_000;
const CAP = 97;

/**
 * Wraps a real progress value and slowly ticks it forward
 * while streaming is active, creating the illusion of movement
 * during long-running backend steps.
 *
 * The drift ceiling is dynamic: instead of a fixed constant,
 * it uses `targetProgress` (the value progress will reach when
 * all currently active phases complete). This makes the drift
 * proportional to the actual work remaining in the active phase(s),
 * so a heavy phase like "recording audio" (weight 50) gets a wide
 * drift range while a light phase like "saving" (weight 2) gets
 * a narrow one.
 *
 * Uses a high-water mark to ensure the displayed value never decreases,
 * preventing visual "snap-back" when real progress drops after drift inflation.
 */
export function useAnimatedProgress({
  isActive,
  realProgress,
  targetProgress,
}: {
  isActive: boolean;
  realProgress: number;
  targetProgress: number;
}): number {
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
    if (!isActive) {
      setDisplay(realProgress);
      highWaterRef.current = realProgress;
      cancelAnimationFrame(rafRef.current);
      return;
    }

    function tick() {
      const gap = Math.max(0, targetProgress - baseRef.current);
      const elapsed = performance.now() - startTimeRef.current;
      const drift = gap * (1 - Math.exp(-elapsed / HALF_LIFE));
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
  }, [isActive, realProgress, targetProgress]);

  return display;
}
