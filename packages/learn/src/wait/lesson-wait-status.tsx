"use client";

import { useExtracted } from "next-intl";
import { type LessonKind } from "../generation/generation-kinds";
import { type GenerationRun, toHeldRun } from "../generation/generation-run";
import { useGenerationProgress } from "../generation/generation-wait";
import { WaitStatus } from "./wait-status";

/** A lesson being written, as the strip over the quiz on the lesson's waits. */
export function LessonWaitStatus({
  holding,
  kind,
  run,
  since,
}: {
  holding: boolean;
  kind: LessonKind;
  run: GenerationRun;
  since: number;
}) {
  const t = useExtracted();

  const gettingReady =
    kind === "challenge" ? t("Getting your challenge ready") : t("Getting your lesson ready");

  const value = useGenerationProgress({ kind, run: holding ? toHeldRun(run) : run, since });

  return (
    <WaitStatus done={holding} value={value}>
      {holding ? t("Your lesson is ready") : gettingReady}
    </WaitStatus>
  );
}
