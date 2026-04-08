"use client";

import { useExtracted } from "next-intl";
import { type StepResult } from "../player-reducer";
import { useReplaceName } from "../user-name-context";
import { VerdictLabel } from "./verdict-label";

export function InlineFeedback({
  children,
  result,
}: {
  children?: React.ReactNode;
  result: StepResult;
}) {
  const t = useExtracted();
  const replaceName = useReplaceName();
  const isCorrect = result.result.isCorrect;
  const feedback = result.result.feedback ? replaceName(result.result.feedback) : null;

  return (
    <div
      aria-label={t("Answer feedback")}
      aria-live="polite"
      className="flex flex-col gap-3"
      role="region"
    >
      <VerdictLabel verdict={isCorrect ? "correct" : "incorrect"} />

      {feedback && <p className="text-muted-foreground text-sm">{feedback}</p>}

      {children}
    </div>
  );
}
