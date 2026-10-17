"use client";

import { useExtracted } from "next-intl";
import { FinishReady } from "../../_components/finish-ready";
import { TaskActions } from "../../_components/task-layout";
import { TaskMainButton } from "../../shell/task-frame";
import { type QuestionBlockPhase } from "./question-block-state";

/** A block opened again with every answer in: where the learner is, and what Finish shows. */
export function FinishReadyBody({ phase }: { phase: QuestionBlockPhase }) {
  return phase.kind === "finishReady" ? <FinishReady /> : null;
}

/**
 * Finish in the bar of a block opened again with every answer in: completing it can prepare the
 * rest of the day, so it waits for this tap (or Enter).
 */
export function FinishReadyActions({
  onFinish,
  phase,
}: {
  onFinish: () => void;
  phase: QuestionBlockPhase;
}) {
  const t = useExtracted();

  if (phase.kind !== "finishReady") {
    return null;
  }

  return (
    <TaskActions>
      <TaskMainButton onClick={onFinish}>{t("Finish")}</TaskMainButton>
    </TaskActions>
  );
}
