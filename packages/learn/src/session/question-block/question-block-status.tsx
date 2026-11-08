"use client";

import { useExtracted } from "next-intl";
import { AnswersSaveError } from "../../_components/save-error";
import { type QuestionBlockPhase } from "./question-block-state";

export function QuestionBlockStatus({
  failures,
  onRetryAnswer,
  onRetryFinish,
  phase,
}: {
  failures: number;
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
    return <AnswersSaveError failures={failures} onRetry={onRetryAnswer} />;
  }

  if (phase.kind === "finishFailed") {
    return <AnswersSaveError failures={failures} onRetry={onRetryFinish} />;
  }

  return null;
}
