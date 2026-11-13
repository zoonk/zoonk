"use client";

import { Button } from "@zoonk/ui/components/button";
import { showErrorToast } from "@zoonk/ui/components/toast";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useSentenceSpace } from "../_utils/locale";
import { useContentFeedback } from "../feedback/feedback-context";

function ReportSaveProblem() {
  const t = useExtracted("feedback");
  const feedback = useContentFeedback();

  if (!feedback) {
    return null;
  }

  return (
    <Button
      className="inline-flex"
      icon={<FlagIcon aria-hidden="true" />}
      onClick={() =>
        feedback.openFeedbackForm({
          context: { reportType: "saveFailure", screen: "answers-save-error" },
          isReport: true,
        })
      }
      type="button"
      variant="link"
    >
      {t("Report a problem")}
    </Button>
  );
}

/** Answers a save didn't take, kept for Try again, with the saves that failed in a row. */
export type UnsentAnswers<Answers> = { answers: Answers; failures: number };

/** `failures` counts the saves that failed in a row, so a retry that fails again reads differently. */
export function AnswersSaveError({
  failures,
  onRetry,
}: {
  failures: number;
  onRetry?: () => void;
}) {
  const t = useExtracted();
  const space = useSentenceSpace();

  return (
    <div className="flex flex-col items-start gap-1">
      <p className="text-destructive-text text-sm" role="alert">
        {failures > 1
          ? t("Still not going through. You can come back later.")
          : t("That didn't go through. Your answers are kept.")}
        {onRetry && (
          <>
            {space}
            <Button onClick={onRetry} variant="link">
              {t("Try again")}
            </Button>
          </>
        )}
      </p>
      {failures > 1 && <ReportSaveProblem />}
    </div>
  );
}

export function useChangeSaveErrorMessage(): string {
  const t = useExtracted();
  return t("That didn't save. Try again.");
}

/** A change that didn't save says so in the shared toast, so nothing under its control moves. */
export function useChangeSaveFailed(): () => void {
  const message = useChangeSaveErrorMessage();
  return () => showErrorToast(message);
}

export function ChangeSaveError({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const message = useChangeSaveErrorMessage();

  return (
    <p className={cn("text-destructive-text text-sm", className)} role="alert">
      {children ?? message}
    </p>
  );
}
