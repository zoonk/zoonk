"use client";

import { useEffect, useEffectEvent } from "react";

const FALLBACK_REFRESH_MS = 20_000;
const READY_REFRESH_MS = 2000;

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
