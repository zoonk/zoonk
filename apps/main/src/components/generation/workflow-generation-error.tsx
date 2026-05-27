"use client";

import { type GenerationErrorKind } from "@/lib/workflow/generation-store";
import { useExtracted } from "next-intl";
import { GenerationProgressError } from "./generation-progress";

/**
 * Keeps workflow transport failures visually separate from real generation
 * failures. A dropped phone connection does not mean the server workflow failed,
 * so the retry action should re-read the server state instead of starting a new
 * generation run.
 */
export function WorkflowGenerationError({
  error,
  errorKind,
  onRetry,
}: {
  error: string | null;
  errorKind: GenerationErrorKind | null;
  onRetry: () => void;
}) {
  const t = useExtracted();
  const isConnectionError = errorKind === "connection";

  if (isConnectionError) {
    return (
      <GenerationProgressError
        description={
          error || t("We lost the progress connection. Your content may still be generating.")
        }
        onRetry={onRetry}
        retryLabel={t("Check again")}
      >
        {t("Connection interrupted")}
      </GenerationProgressError>
    );
  }

  return (
    <GenerationProgressError
      description={error || t("Something went wrong. Please try again.")}
      onRetry={onRetry}
      retryLabel={t("Try again")}
    >
      {t("Something went wrong")}
    </GenerationProgressError>
  );
}
