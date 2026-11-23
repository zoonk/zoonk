"use client";

import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { useExtracted } from "next-intl";

export type EssayStatus = "error" | "idle" | "pending";

/** Grading takes about 9 to 17 s, and up to 24 s on the fallback model. */
export const GRADING_BOUNDS = { slowMs: 20_000, timeoutMs: 90_000 } as const;

export function StatusLine({ saveFailed, status }: { saveFailed: boolean; status: EssayStatus }) {
  const t = useExtracted();
  const isSlow = useTakingLong({ active: status === "pending", afterMs: GRADING_BOUNDS.slowMs });

  if (status === "error") {
    return (
      <p className="text-destructive-text text-sm" role="alert">
        {t("That didn't go through. Your text is still here. Try again in a moment.")}
      </p>
    );
  }

  if (status === "pending") {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {isSlow
          ? t("Still grading. This is taking longer than usual.")
          : t("Reading your answer against each criterion. It can take up to 30 seconds.")}
      </p>
    );
  }

  if (saveFailed) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("Not saved yet. It's kept on this device.")}
      </p>
    );
  }

  return null;
}
