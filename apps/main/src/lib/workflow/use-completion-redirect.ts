"use client";

import { logError } from "@zoonk/utils/logger";
import { useEffect, useEffectEvent } from "react";
import { type GenerationStatus } from "./generation-store";

const DEFAULT_REDIRECT_DELAY_MS = 1500;

/** Identifies the known Safari response interruption so it does not create a false alert. */
function isExpectedResponseInterruption(error: unknown): boolean {
  return error instanceof TypeError && error.message === "Load failed";
}

export function useCompletionRedirect(config: {
  beforeRedirect: () => Promise<void>;
  delay?: number;
  status: GenerationStatus;
  url: string;
}) {
  const { beforeRedirect, delay = DEFAULT_REDIRECT_DELAY_MS, status, url } = config;

  const onRedirect = useEffectEvent(async () => {
    await beforeRedirect().catch((error: unknown) => {
      if (isExpectedResponseInterruption(error)) {
        return;
      }

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
