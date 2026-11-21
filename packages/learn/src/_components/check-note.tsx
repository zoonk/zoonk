"use client";

import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { useExtracted } from "next-intl";

/** How long a check runs before its screen says it's taking longer than usual. */
export const CHECK_SLOW_MS = 15_000;

/**
 * The line a bar's `note` holds about its main action's check: that it's slow, or that it failed.
 * Null while there's nothing to say, so the bar draws no note.
 */
export function useCheckNote({
  checking,
  failed = false,
}: {
  checking: boolean;
  failed?: boolean;
}): React.ReactNode {
  const t = useExtracted();
  const isSlow = useTakingLong({ active: checking, afterMs: CHECK_SLOW_MS });

  if (failed) {
    return (
      <p className="text-destructive-text">
        {t("We couldn't check your answer this time. Try again.")}
      </p>
    );
  }

  if (isSlow) {
    return (
      <p className="text-muted-foreground">
        {t("Still checking. This is taking longer than usual.")}
      </p>
    );
  }

  return null;
}
