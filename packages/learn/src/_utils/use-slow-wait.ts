"use client";

import { useEffect, useState } from "react";
import { type WaitState, getWaitChanges, getWaitState } from "./wait-state";

/** `since` is the `Date.now()` of a tap made before this screen showed the wait, so its line doesn't start over. */
export function useSlowWait(isPending: boolean, { since }: { since?: number } = {}): WaitState {
  const [state, setState] = useState<WaitState>(() =>
    isPending && since !== undefined ? getWaitState(Date.now() - since) : "none",
  );

  useEffect(() => {
    if (!isPending) {
      return;
    }

    const start = since ?? Date.now();
    const read = () => setState(getWaitState(Date.now() - start));

    const timers = [0, ...getWaitChanges(Date.now() - start)].map((delay) =>
      setTimeout(read, delay),
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      setState("none");
    };
  }, [isPending, since]);

  return isPending ? state : "none";
}
