"use client";

import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { createContext, use, useLayoutEffect, useRef, useState } from "react";

const CelebrationContext = createContext(true);

/**
 * A celebration hidden and shown again after at least this long was hidden by the router (a page
 * kept for Back); React's development double run of effects hides and shows it at once.
 */
const SHOWN_AGAIN_MS = 100;

/**
 * Lets the celebrations inside it play only while `play` holds, for a reason only the screen knows:
 * a step the learner comes back to, a result opened again from a link, a page under a ceremony
 * that celebrates first. Scopes inside scopes add up: a celebration plays when every one lets it.
 */
export function CelebrationScope({ children, play }: { children: React.ReactNode; play: boolean }) {
  const outer = use(CelebrationContext);
  return <CelebrationContext value={outer && play}>{children}</CelebrationContext>;
}

/**
 * Whether a celebration plays here: once, on the screen the learner's action opened. A page the
 * server drew (a reload, a link opened anew) shows its end state, and so does a page the router
 * kept and shows again on Back: hiding a kept page ends its effects and showing it restarts its
 * CSS animations, so the celebration ends before it's painted again. Moving parts take their
 * `animate-*` classes only while it's true; `CountUp` and `Burst` follow it on their own.
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
