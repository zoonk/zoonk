"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * A task that shows its screens one after another on the same page (a question, then the next,
 * then its end) opens each at the top: the page stays where the learner scrolled the last one,
 * often down at its feedback. Pass what tells the screens apart.
 */
export function useScreenAtTop(screen: unknown) {
  const shown = useRef<unknown>(null);

  useLayoutEffect(() => {
    if (shown.current !== screen) {
      shown.current = screen;
      window.scrollTo({ behavior: "instant", top: 0 });
    }
  }, [screen]);
}
