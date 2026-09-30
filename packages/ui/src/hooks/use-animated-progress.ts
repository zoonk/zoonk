"use client";

import { useEffect, useRef, useState } from "react";
import { getDriftedProgress } from "./_utils/drift-progress";

/** One decimal is enough for the bar's width; the label shows whole percents. */
const PRECISION = 10;

/**
 * The bar takes a step this often and its width eases over most of it (the timeline's transition),
 * so it keeps moving without re-rendering every frame, and animations settle between steps.
 */
const STEP_MS = 1000;

/**
 * A progress bar that keeps moving while the work does. `progress` is the share of work finished
 * (0 to 100) and `target` where it will be once the running phase finishes; while `active`, the
 * shown value drifts from one toward the other at the phase's `estimatedMs` pace, never going
 * back and never reaching 100 before `progress` does. Inactive, it holds where it was (a failure)
 * or jumps to `progress` when that's ahead (done). A restarted run starts over from its own
 * progress.
 */
export function useAnimatedProgress({
  active,
  estimatedMs,
  progress,
  target,
}: {
  active: boolean;
  estimatedMs: number | null;
  progress: number;
  target: number;
}): number {
  const [display, setDisplay] = useState(progress);
  const shownRef = useRef(progress);
  const progressRef = useRef(progress);

  useEffect(() => {
    const restarted = progress < progressRef.current;
    progressRef.current = progress;

    if (!active) {
      return;
    }

    const base = restarted ? progress : Math.max(shownRef.current, progress);
    const startedAt = performance.now();

    function step() {
      const elapsedMs = performance.now() - startedAt;
      const value = getDriftedProgress({ base, elapsedMs, estimatedMs, target });

      shownRef.current = value;
      setDisplay(Math.floor(value * PRECISION) / PRECISION);
    }

    const first = setTimeout(step, 0);
    const timer = setInterval(step, STEP_MS);

    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [active, estimatedMs, progress, target]);

  return Math.max(display, progress);
}
