"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

/**
 * A save of the learner's answers that didn't go through, said the same way on every task: what
 * they answered stays on screen, and Try again sends it again.
 */
export function AnswersSaveError({ onRetry }: { onRetry: () => void }) {
  const t = useExtracted();

  return (
    <p className="text-destructive-text text-sm" role="alert">
      {t("That didn't go through. Your answers are kept.")}{" "}
      <Button onClick={onRetry} variant="link">
        {t("Try again")}
      </Button>
    </p>
  );
}

/**
 * What a setting, a plan change or a suggestion's answer says when it didn't save. Nothing of the
 * learner's is kept: the screen shows what's saved, and the control they used tries again.
 */
export function useChangeSaveErrorMessage(): string {
  const t = useExtracted();
  return t("That didn't save. Try again.");
}

/** A change that didn't save, said under the control that made it (`useChangeSaveErrorMessage`). */
export function ChangeSaveError({ className }: { className?: string }) {
  const message = useChangeSaveErrorMessage();

  return (
    <p className={cn("text-destructive-text text-sm", className)} role="alert">
      {message}
    </p>
  );
}
