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
 * Detects when the backend has moved into a new active phase window.
 * The displayed percentage may already equal the new real progress because the
 * previous phase drifted to its target, so real progress alone is not enough to
 * know when the elapsed timer should restart.
 */
function hasProgressWindowChanged({
  estimatedDurationMs,
  previousEstimatedDurationMs,
  previousTargetProgress,
  targetProgress,
}: {
  estimatedDurationMs?: number | undefined;
  previousEstimatedDurationMs?: number | undefined;
  previousTargetProgress: number;
  targetProgress: number;
}) {
  return (
    targetProgress !== previousTargetProgress || estimatedDurationMs !== previousEstimatedDurationMs
  );
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
  const startTimeRef = useRef<number | null>(null);
  const baseRef = useRef(realProgress);
  const highWaterRef = useRef(realProgress);
  const estimatedDurationRef = useRef(estimatedDurationMs);
  const targetProgressRef = useRef(targetProgress);

  useEffect(() => {
    const progressWindowChanged = hasProgressWindowChanged({
      estimatedDurationMs,
      previousEstimatedDurationMs: estimatedDurationRef.current,
      previousTargetProgress: targetProgressRef.current,
      targetProgress,
    });

    baseRef.current = realProgress;
    estimatedDurationRef.current = estimatedDurationMs;
    targetProgressRef.current = targetProgress;

    if (realProgress > highWaterRef.current || progressWindowChanged) {
      highWaterRef.current = Math.max(highWaterRef.current, realProgress);
      startTimeRef.current = performance.now();
    }
  }, [estimatedDurationMs, realProgress, targetProgress]);

  useEffect(() => {
    if (!isActive) {
      setDisplay(realProgress);
      highWaterRef.current = realProgress;
      startTimeRef.current = null;
      cancelAnimationFrame(rafRef.current);
      return;
    }

    function tick() {
      const gap = Math.max(0, targetProgress - baseRef.current);
      const now = performance.now();
      startTimeRef.current ??= now;
      const elapsed = now - startTimeRef.current;
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
