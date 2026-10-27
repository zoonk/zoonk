"use client";

import { type RouterTransitionType } from "next";
import { usePathname, useRouter, useSelectedLayoutSegment } from "next/navigation";
import { useEffect, useEffectEvent, useLayoutEffect, useRef } from "react";
import { onOtherTabWrite, takeSettledAppWrites } from "./app-write-ledger";

/** As long as Next.js keeps a page in the browser before reading it again (its default stale time). */
const STALE_MS = 300_000;

/** The app's frame (`(app)/layout.tsx`): the pages a learner comes back to, unlike task screens. */
const FRAME_SEGMENT = "(app)";

/**
 * Whether the router's latest navigation went Back or Forward. Next.js draws that page inside its
 * own `popstate` listener, before any other one hears it, so the router says it as it starts.
 */
let traversing = false;

/** Called as each router navigation starts (`onRouterTransitionStart`, `instrumentation-client.ts`). */
export function noteRouterTransition(navigationType: RouterTransitionType): void {
  traversing = navigationType === "traverse";
}

/**
 * Reads the pages again when what the browser keeps of them may be out of date, so the next one
 * shown is current. Leaving a task screen (a lesson, a session…) does once the writes sent from it
 * settle (`noteAppWrite`), unless the navigation already read their result. Showing a frame page
 * after any write does too; leaving the frame for a task screen doesn't, since that screen reads
 * its own answer. A frame page shown again, by Back or Forward (which Next.js restores at any
 * age) or by coming back to the tab,
 * reads again once the pages were last read five minutes ago or more (the day may have changed, or
 * they studied on another device), or after another tab wrote. A task screen on screen is never
 * read again under the learner. Draws nothing.
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
