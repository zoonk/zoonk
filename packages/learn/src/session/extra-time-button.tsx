"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useSessionAction } from "./use-session-action";

/**
 * "Study 10 more minutes" once the day's session is done: a text button under the actions, since
 * the day's main action is seeing what changed. Core offers it only while there's
 * something left to practice or learn, so a failure here is a connection problem worth retrying.
 */
export function ExtraTimeButton({
  action,
  className,
  label,
  minutes,
}: {
  action: () => Promise<boolean>;
  /** Its width and place where it sits (`lg:w-auto` beside other actions). */
  className?: string;
  /** What the time is for, when it's more specific than "Study 10 more minutes". */
  label?: string;
  minutes: number;
}) {
  const t = useExtracted();
  const { failed, isPending, run } = useSessionAction({ action });

  return (
    <>
      <Button
        className={cn("w-full", className)}
        disabled={isPending}
        onClick={run}
        size="xl"
        variant="ghost"
      >
        {label ?? t("Study {minutes} more minutes", { minutes: String(minutes) })}
      </Button>

      {failed && (
        <p className="text-destructive-text text-sm" role="alert">
          {t("We couldn't add more time. Try again.")}
        </p>
      )}
    </>
  );
}
