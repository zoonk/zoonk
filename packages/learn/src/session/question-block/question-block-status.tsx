"use client";

import { useExtracted } from "next-intl";
import { AnswersSaveError } from "../../_components/save-error";
import { ContinueButton, QuestionActionsRow } from "./question-actions";
import { type QuestionBlockPhase } from "./question-block-state";

/** What the bar says above its actions while an answer or the block is being saved, or failed. */
export function QuestionBlockStatus({
  onContinue,
  onRetryAnswer,
  onRetryFinish,
  phase,
}: {
  onContinue: () => void;
  /** Sends the answer on screen again, as Check does. */
  onRetryAnswer: () => void;
  onRetryFinish: () => void;
  phase: QuestionBlockPhase;
}) {
  const t = useExtracted();

  if (phase.kind === "alreadyAnswered") {
    return (
      <>
        <p className="text-muted-foreground text-sm" role="status">
          {t("You already answered this question.")}
        </p>
        <QuestionActionsRow ask={null}>
          <ContinueButton onContinue={onContinue} />
        </QuestionActionsRow>
      </>
    );
  }

  if (phase.kind === "answerFailed") {
    return <AnswersSaveError onRetry={onRetryAnswer} />;
  }

  if (phase.kind === "finishFailed") {
    return <AnswersSaveError onRetry={onRetryFinish} />;
  }

  return null;
}
