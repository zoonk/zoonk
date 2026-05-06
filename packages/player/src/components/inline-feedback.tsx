"use client";

import { useExtracted } from "next-intl";
import { type StepResult } from "../player-reducer";
import { PlayerRichText } from "./player-rich-text";
import { VerdictLabel } from "./verdict-label";

export function InlineFeedback({
  children,
  result,
}: {
  children?: React.ReactNode;
  result: StepResult;
}) {
  const t = useExtracted();
  const isCorrect = result.result.isCorrect;
  const feedback = result.result.feedback;

  return (
    <div
      aria-label={t("Answer feedback")}
      aria-live="polite"
      className="flex flex-col gap-3"
      role="region"
    >
      <VerdictLabel verdict={isCorrect ? "correct" : "incorrect"} />

      {feedback && (
        <p className="text-muted-foreground text-sm">
          <PlayerRichText text={feedback} />
        </p>
      )}

      {children}
    </div>
  );
}
