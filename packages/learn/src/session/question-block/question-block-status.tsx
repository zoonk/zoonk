"use client";

import { useExtracted } from "next-intl";
import { AnswersSaveError } from "../../_components/save-error";
import { type QuestionBlockPhase } from "./question-block-state";

export function QuestionBlockStatus({
  onRetryAnswer,
  onRetryFinish,
  phase,
}: {
  onRetryAnswer: () => void;
  onRetryFinish: () => void;
  phase: QuestionBlockPhase;
}) {
  const t = useExtracted();

  if (phase.kind === "alreadyAnswered") {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("You already answered this question.")}
      </p>
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
