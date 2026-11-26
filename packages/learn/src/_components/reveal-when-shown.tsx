"use client";

import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { createContext, use, useEffect, useRef } from "react";

const RevealedByScreen = createContext(false);

/** Around a screen that scrolls its own feedback into sight, as the lesson player does. */
export function OwnFeedbackReveal({ children }: { children: React.ReactNode }) {
  return <RevealedByScreen value>{children}</RevealedByScreen>;
}

/**
 * Scrolls the element it's placed in into sight once it appears, if it's below the fold or under
 * the pinned bar (the page's scroll padding keeps it clear of the bar), and leaves it be when it's
 * already in sight. One frame later, so the bar holds its new action first.
 */
export function RevealWhenShown() {
  const marker = useRef<HTMLSpanElement>(null);
  const revealedByScreen = use(RevealedByScreen);

  useEffect(() => {
    if (revealedByScreen) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      marker.current?.parentElement?.scrollIntoView({
        behavior: getScrollBehavior(),
        block: "nearest",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [revealedByScreen]);

  return <span hidden ref={marker} />;
}
