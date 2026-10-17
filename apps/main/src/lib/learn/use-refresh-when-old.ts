"use client";

import { useRouter } from "@/i18n/navigation";
import { useEffect, useRef } from "react";

/** A copy read this recently is the page as it is: reading it again would change nothing. */
const FRESH_MS = 3000;

/**
 * A tab opens from the browser's copy of it (prefetched, or visited before), so it paints at once.
 * Some writes never clear that copy, like a session's blocks (a Server Action that revalidates
 * would re-render the session mid-moment), another device, or a lesson written meanwhile: each
 * time the tab shows a copy older than a few seconds, it reads itself again and only what changed
 * updates. It never reads again right after reading, so a server clock ahead of or behind the
 * browser's can't loop, and the copy a refresh brings back counts as fresh however long it took
 * to read: a read slower than `FRESH_MS` otherwise arrived old and read itself again, over and over.
 */
export function useRefreshWhenOld(readAt: number) {
  const router = useRouter();
  const lastRefresh = useRef(0);
  const refreshedFrom = useRef<number | null>(null);

  useEffect(() => {
    if (refreshedFrom.current !== null && refreshedFrom.current !== readAt) {
      refreshedFrom.current = null;
      return;
    }

    const now = Date.now();

    if (now - readAt > FRESH_MS && now - lastRefresh.current > FRESH_MS) {
      lastRefresh.current = now;
      refreshedFrom.current = readAt;
      router.refresh();
    }
  }, [readAt, router]);
}
