"use client";

import { useEffect, useState } from "react";

const MIN_INTERVAL_MS = 2200;
const MAX_INTERVAL_MS = 3600;

export function useTickCount({ resetKey }: { resetKey: string }): number {
  const [state, setState] = useState({ count: 0, resetKey });

  if (state.resetKey !== resetKey) {
    setState({ count: 0, resetKey });
  }

  useEffect(() => {
    function schedule() {
      const delay = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);

      return setTimeout(() => {
        setState((current) => ({ ...current, count: current.count + 1 }));
        timer = schedule();
      }, delay);
    }

    let timer = schedule();
    return () => clearTimeout(timer);
  }, []);

  return state.resetKey === resetKey ? state.count : 0;
}
