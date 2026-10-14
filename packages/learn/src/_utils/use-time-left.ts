"use client";

import { useEffect, useState } from "react";

const MS_PER_SECOND = 1000;

/**
 * The time left to a deadline in milliseconds, never below 0 (Infinity without one), read again
 * every `tickMs`: every second for a clock that ticks, less often for one that says whole minutes.
 */
export function useTimeLeft({
  deadline,
  tickMs = MS_PER_SECOND,
}: {
  deadline?: string | null;
  tickMs?: number;
}): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) {
      return;
    }

    const timer = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [deadline, tickMs]);

  return deadline ? Math.max(0, new Date(deadline).getTime() - now) : Infinity;
}
