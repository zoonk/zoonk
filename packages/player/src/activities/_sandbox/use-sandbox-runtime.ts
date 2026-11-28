"use client";

import { type ProgramKind } from "@zoonk/core/library/activities/program-limits";
import { useEffect, useState } from "react";
import { warmUpSandbox } from "./sandbox-host";

export type SandboxRuntimeStatus = "failed" | "loading" | "ready";

function runtimeStatus(
  loaded: { attempt: number; isReady: boolean } | null,
  attempt: number,
): SandboxRuntimeStatus {
  if (loaded?.attempt !== attempt) {
    return "loading";
  }

  return loaded.isReady ? "ready" : "failed";
}

/** Null for a language our servers run: nothing loads on the device. */
export function useSandboxRuntime(kind: ProgramKind | null): {
  retry: () => void;
  status: SandboxRuntimeStatus;
} {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ attempt: number; isReady: boolean } | null>(null);

  useEffect(() => {
    if (!kind) {
      return;
    }

    const subscription = { isActive: true };

    void warmUpSandbox(kind).then((isReady) => {
      if (subscription.isActive) {
        setLoaded({ attempt, isReady });
      }
    });

    return () => {
      subscription.isActive = false;
    };
  }, [attempt, kind]);

  const status = kind ? runtimeStatus(loaded, attempt) : "ready";

  return { retry: () => setAttempt((current) => current + 1), status };
}
