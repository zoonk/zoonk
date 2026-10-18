"use client";

import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { ContinueButton, QuestionActionsRow } from "./question-actions";
import { type QuestionBlockPhase } from "./question-block-state";

/** What the bar says above its actions while an answer or the block is being saved, or failed. */
export function QuestionBlockStatus({
  onContinue,
  onRetry,
  phase,
}: {
  onContinue: () => void;
  onRetry: () => void;
  phase: QuestionBlockPhase;
}) {
  const t = useExtracted();

  if (phase.kind === "alreadyAnswered") {
    return (
      <>
        <p className="text-muted-foreground text-sm" role="status">
          {t("You already answered this question.")}
        </p>
        <QuestionActionsRow ask={null} missed={false}>
          <ContinueButton onContinue={onContinue} />
        </QuestionActionsRow>
      </>
    );
  }

  if (phase.kind === "answerFailed") {
    return (
      <p className="text-destructive-text text-sm" role="alert">
        {t("We couldn't save that answer. Check it again.")}
      </p>
    );
  }

  if (phase.kind === "finishFailed") {
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className="text-destructive-text text-sm">{t("We couldn't save this block yet.")}</p>
        <Button onClick={onRetry} size="sm" variant="outline">
          {t("Try again")}
        </Button>
      </div>
    );
  }

  if (phase.kind === "finishing") {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
        <Spinner />
        {t("Saving your answers…")}
      </p>
    );
  }

  return null;
}
