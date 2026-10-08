"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useSessionAction } from "./use-session-action";

/**
 * "Study 10 more minutes" once the day's session is done: a text button, since the day's main
 * action is seeing what changed, or the main one (`variant="default"`) on a day with nothing new.
 * Core offers it only while there's something left to practice or learn, so a failure here is a
 * connection problem worth retrying.
 */
export function ExtraTimeButton({
  action,
  label,
  minutes,
  variant = "ghost",
}: {
  action: () => Promise<boolean>;
  /** What the time is for, when it's more specific than "Study 10 more minutes". */
  label?: string;
  minutes: number;
  variant?: "default" | "ghost";
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
        variant={variant}
      >
        {label ?? t("Study {minutes} more minutes", { minutes: String(minutes) })}
      </Button>

      {failed && (
        <p className="text-destructive text-center text-sm" role="alert">
          {t("We couldn't add more time. Try again.")}
        </p>
      )}
    </>
  );
}
