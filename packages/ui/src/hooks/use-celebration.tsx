"use client";

import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { createContext, use, useLayoutEffect, useRef, useState } from "react";

const CelebrationContext = createContext(true);

/** Hidden this long means the router kept the page for Back; React's development double run of effects hides and shows at once. */
const SHOWN_AGAIN_MS = 100;

/** Nested scopes add up: a celebration plays only when every one lets it. */
export function CelebrationScope({ children, play }: { children: React.ReactNode; play: boolean }) {
  const outer = use(CelebrationContext);
  return <CelebrationContext value={outer && play}>{children}</CelebrationContext>;
}

/**
 * Plays once, on the screen the learner's action opened. A server-drawn page or one the router shows
 * again on Back shows the end state: showing a kept page would restart its CSS animations.
 */
export function useCelebration(): boolean {
  const allowed = use(CelebrationContext);
  // False while the server's page hydrates: that page wasn't opened by an action.
  const opened = useIsMounted();
  const [fresh, setFresh] = useState(opened);
  const hiddenAt = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!fresh) {
      return;
    }

    if (hiddenAt.current !== null && performance.now() - hiddenAt.current > SHOWN_AGAIN_MS) {
      // oxlint-disable-next-line react/set-state-in-effect -- Only the router's showing it again tells; this re-render lands before the paint.
      setFresh(false);
      return;
    }

    return () => {
      hiddenAt.current = performance.now();
    };
  }, [fresh]);

  return allowed && fresh;
}
