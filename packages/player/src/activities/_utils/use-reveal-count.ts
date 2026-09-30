"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 1200;

/**
 * How many runs to show while a simulation fills in: all of them over about a second, or all at
 * once when the device asks for reduced motion. A new `runKey` starts the count again.
 */
export function useRevealCount({
  instant,
  runKey,
  total,
}: {
  instant: boolean;
  runKey: number;
  total: number;
}): number {
  const [progress, setProgress] = useState({ count: 0, runKey });

  useEffect(() => {
    if (instant || total === 0) {
      return;
    }

    const frame = { id: 0 };
    const start = performance.now();

    function tick(now: number) {
      const share = Math.min((now - start) / DURATION_MS, 1);
      setProgress({ count: Math.round(share * total), runKey });

      if (share < 1) {
        frame.id = requestAnimationFrame(tick);
      }
    }

    frame.id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.id);
  }, [instant, runKey, total]);

  if (instant) {
    return total;
  }

  return progress.runKey === runKey ? progress.count : 0;
}
