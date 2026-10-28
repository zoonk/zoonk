"use client";

import { useEffect, useRef, useState } from "react";
import { getDriftedProgress } from "./_utils/drift-progress";

const PRECISION = 10;

const STEP_MS = 1000;

/** `target` is where `progress` will be once the running phase finishes. */
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
