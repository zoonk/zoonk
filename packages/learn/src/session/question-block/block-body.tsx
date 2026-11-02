"use client";

import { useExtracted } from "next-intl";
import { TaskBody } from "../../_components/task-layout";
import { PendingMoment } from "../pending-moment";
import { type StudyBlockDetail } from "../session-types";
import { useMomentTitle } from "../use-moment-title";
import { type QuestionBlockPhase } from "./question-block-state";

export function BlockBody({
  children,
  kind,
  phase,
}: {
  children: React.ReactNode;
  kind: StudyBlockDetail["block"]["kind"];
  phase: QuestionBlockPhase;
}) {
  const t = useExtracted();
  const title = useMomentTitle({ kind, testedOut: false });

  if (phase.kind === "finishing") {
    return <PendingMoment action={t("Continue")} title={title} />;
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
