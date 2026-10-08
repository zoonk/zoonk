"use client";

import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { CoffeeIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useSessionAction } from "../use-session-action";

/**
 * Accuracy dropped sharply: a short break usually helps more than pushing on. Stopping keeps
 * everything done so far; keeping going is just the Continue below.
 */
export function PauseSuggestion({ onStop }: { onStop: () => Promise<boolean> }) {
  const t = useExtracted();
  const { failed, isPending, run } = useSessionAction({ action: onStop });

  return (
    <aside
      aria-label={t("Time for a break?")}
      className="bg-muted/60 flex flex-col gap-3 rounded-2xl p-4"
    >
      <p className="flex items-start gap-2 text-sm">
        <LineMarker>
          <CoffeeIcon aria-hidden="true" className="size-4" />
        </LineMarker>
        {t(
          "A few misses in a row. A short break often helps, and everything you did today counts.",
        )}
      </p>

      <Button className="w-fit" disabled={isPending} onClick={run} size="sm" variant="outline">
        {t("Stop for today")}
      </Button>

      {failed && (
        <p className="text-destructive text-sm" role="alert">
          {t("We couldn't stop the session. Try again.")}
        </p>
      )}
    </aside>
  );
}
