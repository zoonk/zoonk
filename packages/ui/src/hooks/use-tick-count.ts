"use client";

import { useEffect, useState } from "react";

const MIN_INTERVAL_MS = 2200;
const MAX_INTERVAL_MS = 3600;

/**
 * Counts up at a relaxed, slightly irregular pace while `active`, starting over at 0 whenever
 * `resetKey` changes. It drives detail lines that change while a long step runs ("Writing lesson
 * 2…"), slow enough to read each one.
 */
export function useTickCount({ active, resetKey }: { active: boolean; resetKey: string }): number {
  const [state, setState] = useState({ count: 0, resetKey });

  if (state.resetKey !== resetKey) {
    setState({ count: 0, resetKey });
  }

  useEffect(() => {
    if (!active) {
      return;
    }

    function schedule() {
      const delay = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);

      return setTimeout(() => {
        setState((current) => ({ ...current, count: current.count + 1 }));
        timer = schedule();
      }, delay);
    }

    let timer = schedule();
    return () => clearTimeout(timer);
  }, [active]);

  return state.resetKey === resetKey ? state.count : 0;
}
