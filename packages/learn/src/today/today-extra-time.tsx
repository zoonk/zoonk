"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import { useSessionAction } from "../session/use-session-action";

/**
 * More time today, added to the session: "Study 10 more minutes" of practice once every lesson of
 * the plan is done (or "Study for 10 minutes" on such a rest day), the day's main action on a day
 * with nothing new. With lessons of the plan left, "Keep learning" adds them instead (see
 * `TodayAction`). Core offers it only while there's something left to practice or learn, so a
 * failure here is a connection problem worth retrying.
 */
export function TodayExtraTime({
  action,
  className,
  label,
  minutes,
  size = "sm",
  variant = "outline",
}: {
  action: () => Promise<boolean>;
  className?: string;
  /** What the time is for, when it's more specific than "Study 10 more minutes". */
  label?: string;
  minutes: number;
  size?: "lg" | "sm";
  variant?: "default" | "outline";
}) {
  const t = useExtracted();
  const { failed, isPending, run } = useSessionAction({ action });

  return (
    <>
      <Button
        className={className}
        disabled={isPending}
        focusableWhenDisabled
        onClick={run}
        size={size}
        variant={variant}
      >
        {label ?? t("Study {minutes} more minutes", { minutes: String(minutes) })}
      </Button>

      {failed && <ChangeSaveError />}
    </>
  );
}
