"use client";

import { useExtracted } from "next-intl";
import { TaskBody } from "../../_components/task-layout";
import { PendingMoment } from "../pending-moment";
import { type QuestionBlockPhase } from "./question-block-state";

export function BlockBody({
  children,
  phase,
}: {
  children: React.ReactNode;
  phase: QuestionBlockPhase;
}) {
  const t = useExtracted();

  if (phase.kind === "finishing") {
    return <PendingMoment action={t("Continue")} />;
  }

  return <TaskBody data-slot="question-block">{children}</TaskBody>;
}

export function showsQuestionActions({
  phase,
  stage,
}: {
  phase: QuestionBlockPhase;
  stage: string;
}): boolean {
  if (phase.kind === "finishing") {
    return false;
  }

  return stage !== "idea" || phase.kind === "finishReady";
}
