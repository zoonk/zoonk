"use client";

import { Button } from "@zoonk/ui/components/button";
import { CoffeeIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Callout } from "../../_components/callout";
import { useSessionAction } from "../use-session-action";

/**
 * Accuracy dropped sharply: a short break usually helps more than pushing on. One quiet line
 * under the feedback with a small way to stop; stopping keeps everything done so far, and keeping
 * going is just Continue.
 */
export function PauseSuggestion({ onStop }: { onStop: () => Promise<boolean> }) {
  const t = useExtracted();
  const { failed, isPending, run } = useSessionAction({ action: onStop });

  return (
    <aside aria-label={t("Time for a break?")} className="flex flex-col items-start gap-2.5">
      <Callout>
        <CoffeeIcon aria-hidden="true" />
        {t(
          "A few misses in a row. A short break often helps, and everything you did today counts.",
        )}
      </Callout>

      <Button disabled={isPending} onClick={run} size="sm" variant="outline">
        {t("Stop for today")}
      </Button>

      {failed && (
        <p className="text-destructive-text text-sm" role="alert">
          {t("We couldn't stop the session. Try again.")}
        </p>
      )}
    </aside>
  );
}
