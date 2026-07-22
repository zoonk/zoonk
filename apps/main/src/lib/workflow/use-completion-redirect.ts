"use client";

import { logError } from "@zoonk/utils/logger";
import { useEffect, useEffectEvent } from "react";
import { type GenerationStatus } from "./generation-store";

const DEFAULT_REDIRECT_DELAY_MS = 1500;

export function useCompletionRedirect(config: {
  beforeRedirect: () => Promise<void>;
  delay?: number;
  status: GenerationStatus;
  url: string;
}) {
  const { beforeRedirect, delay = DEFAULT_REDIRECT_DELAY_MS, status, url } = config;

  const onRedirect = useEffectEvent(async () => {
    await beforeRedirect().catch((error: unknown) => {
      logError("Generation cache invalidation failed before redirect", error);
    });

    globalThis.location.href = url;
  });

  useEffect(() => {
    if (status !== "completed") {
      return;
    }

    const timer = setTimeout(() => void onRedirect(), delay);
    return () => clearTimeout(timer);
  }, [status, delay]);
}
