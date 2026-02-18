"use client";

import { CircleCheck, CircleX } from "lucide-react";
import { useExtracted } from "next-intl";
import { type StepResult } from "./player-reducer";
import { ResultAnnouncement } from "./result-announcement";
import { useReplaceName } from "./user-name-context";

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
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        {isCorrect ? (
          <>
            <CircleCheck aria-hidden="true" className="text-success size-4" />
            <span className="text-success">{t("Correct!")}</span>
          </>
        ) : (
          <>
            <CircleX aria-hidden="true" className="text-destructive size-4" />
            <span className="text-destructive">{t("Not quite")}</span>
          </>
        )}
      </div>

      {feedback && <p className="text-muted-foreground text-sm">{feedback}</p>}

      {children}

      <ResultAnnouncement isCorrect={isCorrect} />
    </div>
  );
}
