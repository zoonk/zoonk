"use client";

import { type RouterTransitionType } from "next";
import { usePathname, useRouter, useSelectedLayoutSegment } from "next/navigation";
import { useEffect, useEffectEvent, useLayoutEffect, useRef } from "react";
import { onOtherTabWrite, takeSettledAppWrites } from "./app-write-ledger";

/** Next.js's default stale time for a page the browser keeps. */
const STALE_MS = 300_000;

const FRAME_SEGMENT = "(app)";

/** Next.js draws a Back or Forward page inside its own `popstate` listener, before any other one hears it. */
let traversing = false;

export function noteRouterTransition(navigationType: RouterTransitionType): void {
  traversing = navigationType === "traverse";
}

/**
 * Next.js restores a Back or Forward page at any age, so a frame page shown again reads again after
 * five minutes or another tab's write. A task screen on screen is never read again under the learner.
 */
export function RefreshStalePages() {
  const router = useRouter();
  const pathname = usePathname();
  const inFrame = useSelectedLayoutSegment() === FRAME_SEGMENT;
  const shown = useRef<{ inFrame: boolean; pathname: string } | null>(null);
  const readAt = useRef(0);
  const otherTabWrote = useRef(false);

  const refresh = useEffectEvent(({ from, stale }: { from?: string; stale: boolean }) => {
    void takeSettledAppWrites({ from, to: stale ? undefined : pathname }).then((wrote) => {
      if (wrote || stale) {
        readAt.current = Date.now();
        otherTabWrote.current = false;
        router.refresh();
      }
    });
  });

  const isStale = useEffectEvent(
    (shownAgain: boolean) =>
      otherTabWrote.current || (shownAgain && Date.now() - readAt.current >= STALE_MS),
  );

  const onTabShown = useEffectEvent(() => {
    if (inFrame) {
      refresh({ stale: isStale(true) });
    }
  });

  // A layout effect, so a write the new page sends as it opens (a lesson's start) isn't taken yet.
  useLayoutEffect(() => {
    const left = shown.current;

    // StrictMode's extra run in development shows no new page.
    if (left?.pathname === pathname) {
      return;
    }

    shown.current = { inFrame, pathname };

    if (!left) {
      readAt.current = Date.now();
    } else if (inFrame) {
      refresh({ stale: isStale(traversing) });
    } else if (!left.inFrame) {
      refresh({ from: left.pathname, stale: false });
    }
  }, [inFrame, pathname]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        onTabShown();
      }
    };

    const stopHearing = onOtherTabWrite(() => {
      otherTabWrote.current = true;
    });

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopHearing();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
