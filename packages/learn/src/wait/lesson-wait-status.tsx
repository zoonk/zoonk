"use client";

import { useExtracted } from "next-intl";
import { type GenerationRun, toHeldRun } from "../generation/generation-run";
import { useGenerationProgress } from "../generation/generation-wait";
import { WaitStatus } from "./wait-status";

/** A lesson being written, as the strip over the quiz on the lesson's waits. */
export function LessonWaitStatus({
  holding,
  run,
  since,
}: {
  holding: boolean;
  run: GenerationRun;
  since: number;
}) {
  const t = useExtracted();

  const value = useGenerationProgress({
    kind: "lesson",
    run: holding ? toHeldRun(run) : run,
    since,
  });

  return (
    <WaitStatus done={holding} value={value}>
      {holding ? t("Your lesson is ready") : t("Writing your lesson")}
    </WaitStatus>
  );
}
