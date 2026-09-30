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

/**
 * Loads a template's runtime (Pyodide, sql.js) as soon as the template appears, so the first run
 * doesn't wait for the download. `retry` tries again after a failed load, like when offline.
 */
export function useSandboxRuntime(kind: ProgramKind): {
  retry: () => void;
  status: SandboxRuntimeStatus;
} {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ attempt: number; isReady: boolean } | null>(null);

  useEffect(() => {
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

  const status = runtimeStatus(loaded, attempt);

  return { retry: () => setAttempt((current) => current + 1), status };
}
