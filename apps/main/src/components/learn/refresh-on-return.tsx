"use client";

import { useRouter } from "@/i18n/navigation";
import { useEffect, useRef } from "react";

/** As long as Next.js keeps a page in the browser before reading it again (its default stale time). */
const AWAY_MS = 300_000;

/**
 * A tab the learner comes back to after a while reads its page again: the day may have changed
 * since (Today showing yesterday), or they studied on another device. Navigating already reads a
 * page kept this long again; this covers the page on screen.
 */
export function RefreshOnReturn() {
  const router = useRouter();
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }

      if (hiddenAt.current !== null && Date.now() - hiddenAt.current >= AWAY_MS) {
        router.refresh();
      }

      hiddenAt.current = null;
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [router]);

  return null;
}
