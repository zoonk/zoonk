"use client";

import { useEffect, useEffectEvent } from "react";

/**
 * The page is read again this often while the run is followed, in case the content was made by a
 * run the page doesn't see; once the run says it's ready, much sooner, until the page shows it.
 */
const FALLBACK_REFRESH_MS = 20_000;
const READY_REFRESH_MS = 2000;

/**
 * For a wait whose host page shows the content once it exists (Today's first day, the plan): reads
 * the page again (`refresh`) until it does, so the learner never refreshes it themselves.
 */
export function useRefreshUntilShown({
  isReady,
  refresh,
}: {
  isReady: boolean;
  refresh: () => void;
}) {
  const onTick = useEffectEvent(refresh);

  useEffect(() => {
    const timer = setInterval(onTick, isReady ? READY_REFRESH_MS : FALLBACK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [isReady]);
}
