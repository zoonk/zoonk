"use client";

import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { useEffect, useRef } from "react";
import { usePlayerRuntime } from "../player-context";

/** Keeps the final lesson content visible while a stable attempt is saved or retried. */
export function CompletionSaveControl() {
  const t = useExtracted();
  const { actions, completionPersistence } = usePlayerRuntime();
  const statusRef = useRef<HTMLParagraphElement>(null);
  const isSaving = completionPersistence === "saving";

  useEffect(() => {
    if (completionPersistence !== "idle" && statusRef.current?.getClientRects().length) {
      statusRef.current.focus({ preventScroll: true });
    }
  }, [completionPersistence]);

  return (
    <div className="flex w-full flex-col gap-2">
      <Button
        aria-busy={isSaving}
        disabled={completionPersistence !== "failed"}
        onClick={actions.retryCompletion}
        size="lg"
      >
        {isSaving && <Spinner aria-hidden="true" className="motion-reduce:animate-none" />}
        {isSaving ? t("Saving progress…") : t("Retry save")}
      </Button>
      <p
        className="text-muted-foreground text-center text-sm outline-none"
        ref={statusRef}
        role="status"
        tabIndex={-1}
      >
        {isSaving
          ? t("Saving your progress before continuing.")
          : t("Your progress hasn't been saved yet. Try again to save your progress.")}
      </p>
    </div>
  );
}
