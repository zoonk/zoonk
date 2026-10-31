"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

export function AnswersSaveError({ onRetry }: { onRetry?: () => void }) {
  const t = useExtracted();

  return (
    <p className="text-destructive-text text-sm" role="alert">
      {t("That didn't go through. Your answers are kept.")}
      {onRetry && (
        <>
          {" "}
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
