"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent } from "react";
import type { GenerationStatus } from "./generation-store";

type CompletionRedirectConfig = {
  delay?: number;
  status: GenerationStatus;
  url: string;
};

export function useCompletionRedirect(config: CompletionRedirectConfig) {
  const { delay = 1500, status, url } = config;
  const router = useRouter();

  const onRedirect = useEffectEvent(() => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- dynamic route string requires assertion
    router.push(url as never);
  });

  useEffect(() => {
    if (status !== "completed") {
      return;
    }

    const timer = setTimeout(onRedirect, delay);
    return () => clearTimeout(timer);
  }, [status, delay]);
}
