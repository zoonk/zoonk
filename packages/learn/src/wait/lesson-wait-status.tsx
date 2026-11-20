"use client";

import { useExtracted } from "next-intl";
import { type LessonKind } from "../generation/generation-kinds";
import { type GenerationRun, toHeldRun } from "../generation/generation-run";
import { useGenerationStepLabel } from "../generation/generation-step-label";
import { useGenerationProgress } from "../generation/generation-wait";
import { WaitStatus } from "./wait-status";

/**
 * A lesson being written, as the strip over the quiz on the lesson's waits. Under a title that
 * already says the lesson is getting ready (`titled`), the strip says the step it's on instead.
 */
export function LessonWaitStatus({
  holding,
  kind,
  run,
  since,
  titled = false,
}: {
  holding: boolean;
  kind: LessonKind;
  run: GenerationRun;
  since: number;
  titled?: boolean;
}) {
  const t = useExtracted();
  const shown = holding ? toHeldRun(run) : run;
  const step = useGenerationStepLabel({ kind, run: shown });
  const value = useGenerationProgress({ kind, run: shown, since });

  const gettingReady =
    kind === "challenge" ? t("Getting your challenge ready") : t("Getting your lesson ready");

  const ready = kind === "challenge" ? t("Your challenge is ready") : t("Your lesson is ready");
  const sentence = holding ? ready : gettingReady;

  return (
    <WaitStatus done={holding} value={value}>
      {(titled && step) || sentence}
    </WaitStatus>
  );
}
