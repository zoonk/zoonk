"use client";

import { useEffect, useState } from "react";
import { type WaitState, getWaitChanges, getWaitState } from "./wait-state";

/**
 * How long a pending action has been waiting, so a button never just greys out: nothing for a
 * quick one, then that it's on its way, then that it's slow and needs no second tap. A wait a tap
 * started before this screen showed it (`since`, the tap's `Date.now()`) counts from that tap and
 * starts with the line it's already at, so the line neither starts over nor blinks when the screen
 * showing it changes.
 */
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
