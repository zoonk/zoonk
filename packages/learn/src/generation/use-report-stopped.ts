"use client";

import { useEffectEvent, useLayoutEffect } from "react";
import { type GenerationRun, hasStopped } from "./generation-run";

/** Before the next paint, so a wait never shows its quiz under a run that stopped. */
export function useReportStopped({
  onStopped,
  run,
}: {
  onStopped: () => void;
  run: GenerationRun;
}) {
  const stopped = hasStopped(run);
  const report = useEffectEvent(onStopped);

  useLayoutEffect(() => {
    if (stopped) {
      report();
    }
  }, [stopped]);
}
