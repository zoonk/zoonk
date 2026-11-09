"use client";

import { useEffect, useRef, useState } from "react";
import { getDriftedProgress } from "./_utils/drift-progress";

const TENTHS_PER_PERCENT = 10;

const STEP_MS = 1000;

function toTenths(value: number): number {
  return Math.floor(value * TENTHS_PER_PERCENT) / TENTHS_PER_PERCENT;
}

function toWholeSteps(ms: number): number {
  return Math.floor(ms / STEP_MS) * STEP_MS;
}

/**
 * `target` is where `progress` will be once the running phase finishes. `since` is when that phase
 * began (`Date.now()`), so a bar drawn again partway through it, as another screen takes the wait
 * over or a reload learns when it started, goes on from there instead of starting over.
 */
export function useAnimatedProgress({
  active,
  estimatedMs,
  progress,
  since,
  target,
}: {
  active: boolean;
  estimatedMs: number | null;
  progress: number;
  since?: number;
  target: number;
}): number {
  const [display, setDisplay] = useState(() =>
    active && since !== undefined
      ? toTenths(
          getDriftedProgress({
            base: progress,
            elapsedMs: toWholeSteps(Date.now() - since),
            estimatedMs,
            target,
          }),
        )
      : progress,
  );

  const shownRef = useRef(display);
  const progressRef = useRef(progress);

  useEffect(() => {
    const restarted = progress < progressRef.current;
    progressRef.current = progress;

    if (restarted) {
      shownRef.current = progress;
    }

    if (!active) {
      return;
    }

    const base = since === undefined ? Math.max(shownRef.current, progress) : progress;
    const startedAt = since ?? Date.now();

    function step() {
      const elapsedMs = toWholeSteps(Date.now() - startedAt);
      const value = getDriftedProgress({ base, elapsedMs, estimatedMs, target });

      shownRef.current = Math.max(shownRef.current, value);
      setDisplay(toTenths(shownRef.current));
    }

    const first = setTimeout(step, 0);
    const timer = setInterval(step, STEP_MS);

    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [active, estimatedMs, progress, since, target]);

  return Math.max(display, progress);
}
