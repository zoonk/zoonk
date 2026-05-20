"use client";

import { useEffect, useRef, useState } from "react";

const HALF_LIFE = 12_000;
const CAP = 97;

/**
 * Uses the phase's estimated duration when one exists so a long single-step phase
 * advances at the same pace as the time weight that produced the progress target.
 * Without this, a 120-second phase still races toward its full target with the
 * default 12-second half-life because the backend can only report started/done.
 */
function getDriftProgress({
  elapsed,
  estimatedDurationMs,
}: {
  elapsed: number;
  estimatedDurationMs?: number | undefined;
}) {
  if (estimatedDurationMs && estimatedDurationMs > 0) {
    return Math.min(elapsed / estimatedDurationMs, 1);
  }

  return 1 - Math.exp(-elapsed / HALF_LIFE);
}

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
  estimatedDurationMs,
  isActive,
  realProgress,
  targetProgress,
}: {
  estimatedDurationMs?: number | undefined;
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
      const drift = gap * getDriftProgress({ elapsed, estimatedDurationMs });
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
  }, [estimatedDurationMs, isActive, realProgress, targetProgress]);

  return display;
}
