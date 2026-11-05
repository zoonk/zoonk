"use client";

import { createContext, use, useEffectEvent, useLayoutEffect, useRef } from "react";

export const CeremonyClosingContext = createContext<() => void>(() => {
  // Shown on its own, a ceremony has nothing under it to draw.
});

export function useCeremonyClosing(): () => void {
  return use(CeremonyClosingContext);
}

/** Hidden this long means the router kept the page for Back; development's double effect run is instant. */
const SHOWN_AGAIN_MS = 100;

/**
 * The router keeps a page for Back and Forward, but an open dialog stays hidden when it shows the
 * page again (`useHideElement`), so a ceremony left open would hide the result for good.
 */
export function useClosedOnReturn(onReturn: () => void) {
  const hiddenAt = useRef<number | null>(null);
  const close = useEffectEvent(onReturn);

  useLayoutEffect(() => {
    if (hiddenAt.current !== null && performance.now() - hiddenAt.current > SHOWN_AGAIN_MS) {
      close();
    }

    return () => {
      hiddenAt.current = performance.now();
    };
  }, []);
}
