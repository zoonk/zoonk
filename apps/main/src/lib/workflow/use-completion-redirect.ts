"use client";

import { useEffect, useEffectEvent } from "react";
import { type GenerationStatus } from "./generation-store";

const DEFAULT_REDIRECT_DELAY_MS = 1500;

export function useCompletionRedirect(config: {
  delay?: number;
  status: GenerationStatus;
  url: string;
}) {
  const { delay = DEFAULT_REDIRECT_DELAY_MS, status, url } = config;

  const onRedirect = useEffectEvent(() => {
    globalThis.location.href = url;
  });

  useEffect(() => {
    if (status !== "completed") {
      return;
    }

    const timer = setTimeout(onRedirect, delay);
    return () => clearTimeout(timer);
  }, [status, delay]);
}
