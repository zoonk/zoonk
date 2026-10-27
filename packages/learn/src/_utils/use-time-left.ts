"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

const MS_PER_SECOND = 1000;

/**
 * The time left to a deadline in milliseconds, never below 0 (Infinity without one), read again
 * every `tickMs`: every second for a clock that ticks, less often for one that says whole minutes,
 * more often for a bar that slides. `onTimeUp` runs once per deadline, when it's reached.
 */
export function useTimeLeft({
  deadline,
  onTimeUp,
  tickMs = MS_PER_SECOND,
}: {
  deadline?: number | string | null;
  onTimeUp?: () => void;
  tickMs?: number;
}): number {
  const end = deadline ? new Date(deadline).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  const left = end === null ? Infinity : Math.max(0, end - now);
  const over = left === 0;
  const timeUp = useEffectEvent(() => onTimeUp?.());
  const timedUp = useRef<number | null>(null);

  useEffect(() => {
    if (end === null || over) {
      return;
    }

    const timer = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [end, over, tickMs]);

  useEffect(() => {
    if (over && timedUp.current !== end) {
      timedUp.current = end;
      timeUp();
    }
  }, [end, over]);

  return left;
}
