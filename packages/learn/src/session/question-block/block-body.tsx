"use client";

import { TaskBody } from "../../_components/task-layout";
import { PendingMoment } from "../pending-moment";
import { type StudyBlockDetail } from "../session-types";
import { type QuestionBlockPhase } from "./question-block-state";

/** The block's question in view, or its moment drawing in while the block is saved. */
export function BlockBody({
  children,
  kind,
  phase,
}: {
  children: React.ReactNode;
  kind: StudyBlockDetail["block"]["kind"];
  phase: QuestionBlockPhase;
}) {
  if (phase.kind === "finishing") {
    return <PendingMoment kind={kind} />;
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
  // While the block is saved its moment is already drawing, and its own actions come with it.
  if (phase.kind === "finishing") {
    return false;
  }

  return stage !== "idea" || phase.kind === "finishReady";
}
