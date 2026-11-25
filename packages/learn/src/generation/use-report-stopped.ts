"use client";

import { useEffect, useEffectEvent } from "react";
import { type GenerationRun, hasStopped } from "./generation-run";

export function useReportStopped({
  onStopped,
  run,
}: {
  onStopped: () => void;
  run: GenerationRun;
}) {
  const stopped = hasStopped(run);
  const report = useEffectEvent(onStopped);

  useEffect(() => {
    if (stopped) {
      report();
    }
  }, [stopped]);
}
