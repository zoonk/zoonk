"use client";

import { usePoll } from "../_utils/use-poll";
import { type GenerationRun } from "./generation-run";

const FALLBACK_REFRESH_MS = 20_000;
const READY_REFRESH_MS = 2000;

/** Stops after a while, as polling does, and while the run has failed: "Try again" starts it again. */
export function useRefreshUntilShown({
  refresh,
  status,
}: {
  refresh: () => void;
  status: GenerationRun["status"];
}) {
  usePoll({
    active: status !== "failed",
    intervalMs: status === "ready" ? READY_REFRESH_MS : FALLBACK_REFRESH_MS,
    key: status,
    onPoll: refresh,
    startNow: false,
  });
}
