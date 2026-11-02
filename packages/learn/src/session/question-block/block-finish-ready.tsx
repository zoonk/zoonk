"use client";

import { useExtracted } from "next-intl";
import { FinishReady } from "../../_components/finish-ready";
import { TaskActions } from "../../_components/task-layout";
import { TaskMainButton } from "../../shell/task-frame";
import { type QuestionBlockPhase } from "./question-block-state";

export function FinishReadyBody({ phase }: { phase: QuestionBlockPhase }) {
  return phase.kind === "finishReady" ? <FinishReady /> : null;
}

/** Completing it can prepare the rest of the day (AI work), so it waits for this tap. */
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
