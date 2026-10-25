"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useExtracted } from "next-intl";
import { useSessionAction } from "../session/use-session-action";

/**
 * More time today, added to the session: "Keep learning" with the plan's next lessons (the day's
 * main action once it's done or on a rest day), "Study 10 more minutes" of practice once every
 * lesson is done, the day's main action on a day with nothing new. Core offers it only while
 * there's something left to practice or learn, so a failure here is a connection problem worth
 * retrying.
 */
export function TodayExtraTime({
  action,
  className,
  label,
  minutes,
  ref,
  shortcut = false,
  size = "sm",
  variant = "outline",
}: {
  action: () => Promise<boolean>;
  className?: string;
  /** What the time is for, when it's more specific than "Study 10 more minutes". */
  label?: string;
  minutes: number;
  /** Where Enter presses it, when it's the day's main action. */
  ref?: React.Ref<HTMLButtonElement>;
  /** Shows the Enter hint beside its words, as the day's main action does. */
  shortcut?: boolean;
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
        ref={ref}
        size={size}
        variant={variant}
      >
        {label ?? t("Study {minutes} more minutes", { minutes: String(minutes) })}
        {shortcut && <ShortcutKbd tone="inverse">⏎</ShortcutKbd>}
      </Button>

      {failed && (
        <p className="text-destructive-text text-sm" role="alert">
          {t("We couldn't add more time. Try again.")}
        </p>
      )}
    </>
  );
}
