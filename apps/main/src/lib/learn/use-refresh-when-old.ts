"use client";

import { useEffect, useEffectEvent } from "react";

/** A copy read this recently is the page as it is: asking about it would change nothing. */
const FRESH_MS = 3000;

/**
 * A tab opens from the browser's copy of it (prefetched, or visited before), so it paints at once.
 * Some changes never clear that copy, like another device's writes or a lesson written meanwhile:
 * each time the tab shows a copy older than a few seconds, it asks whether what it shows changed
 * since it was read (`refreshIfChanged`, a few small queries) and reads itself again only then.
 * Reading itself again on every show rendered the page twice and dropped every page the browser
 * had prefetched, which each link on screen then fetched again.
 */
export function useRefreshWhenOld(readAt: number, refreshIfChanged: () => Promise<void>) {
  const ask = useEffectEvent(() => void refreshIfChanged());

  useEffect(() => {
    if (Date.now() - readAt > FRESH_MS) {
      ask();
    }
  }, [readAt]);
}
