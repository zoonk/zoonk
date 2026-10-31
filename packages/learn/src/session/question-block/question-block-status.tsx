"use client";

import { useExtracted } from "next-intl";
import { AnswersSaveError } from "../../_components/save-error";
import { ContinueButton, QuestionActionsRow } from "./question-actions";
import { type QuestionBlockPhase } from "./question-block-state";

export function QuestionBlockStatus({
  onContinue,
  onRetryAnswer,
  onRetryFinish,
  phase,
}: {
  onContinue: () => void;
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
