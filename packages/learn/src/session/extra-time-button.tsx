"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useSessionAction } from "./use-session-action";

/** "Study 10 more minutes" once the day's session is done, while it's offered. */
export function ExtraTimeButton({
  action,
  minutes,
}: {
  action: () => Promise<boolean>;
  minutes: number;
}) {
  const t = useExtracted();
  const { failed, isPending, run } = useSessionAction({ action });

  return (
    <>
      <Button
        className="h-12 w-full rounded-full text-base"
        disabled={isPending}
        onClick={run}
        size="lg"
        variant="outline"
      >
        {t("Study {minutes} more minutes", { minutes: String(minutes) })}
      </Button>

      {failed && (
        <p className="text-destructive text-center text-sm" role="alert">
          {t("There's nothing more to practice today. Nice work.")}
        </p>
      )}
    </>
  );
}
