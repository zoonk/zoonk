"use client";

import { useEffect, useState } from "react";

/** A tap that answers within this long needs no word; past it, the screen says it's on its way. */
const SLOW_MS = 1500;

/** Past this, it says it's taking longer than usual, and that tapping again isn't needed. */
const VERY_SLOW_MS = 15_000;

export type WaitState = "none" | "slow" | "verySlow";

/**
 * How long a pending action has been waiting, so a button never just greys out: nothing for a
 * quick one, then that it's on its way, then that it's slow and needs no second tap.
 */
export function useSlowWait(isPending: boolean): WaitState {
  const [state, setState] = useState<WaitState>("none");

  useEffect(() => {
    if (!isPending) {
      return;
    }

    const slow = setTimeout(() => setState("slow"), SLOW_MS);
    const verySlow = setTimeout(() => setState("verySlow"), VERY_SLOW_MS);

    return () => {
      clearTimeout(slow);
      clearTimeout(verySlow);
      setState("none");
    };
  }, [isPending]);

  return isPending ? state : "none";
}
