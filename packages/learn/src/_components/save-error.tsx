"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useSentenceSpace } from "../_utils/locale";

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
  );
}

export function useChangeSaveErrorMessage(): string {
  const t = useExtracted();
  return t("That didn't save. Try again.");
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
