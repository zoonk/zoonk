"use client";

import { isWeekend } from "@zoonk/core/plans/week-shape";
import { Switch } from "@zoonk/ui/components/switch";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId } from "react";

type MissingDays = "weekdays" | "weekend";

/** A weekend time of its own needs a weekend day to use it and a weekday whose time it differs from. */
export function getMissingDays(days: readonly number[]): MissingDays | null {
  if (!days.some((day) => isWeekend(day))) {
    return "weekend";
  }

  return days.some((day) => !isWeekend(day)) ? null : "weekdays";
}

function useMissingDayReason() {
  const t = useExtracted();

  return (missing: MissingDays) =>
    missing === "weekend"
      ? t({
          description:
            "Why a switch for a different study time on weekends is off: no weekend day is a study day.",
          message: "Add Saturday or Sunday to your study days.",
        })
      : t({
          description:
            "Why a switch for a different study time on weekends is off: only weekend days are study days.",
          message: "Add a weekday to your study days.",
        });
}

/**
 * The weekend's time field is always there, off until the switch is on, so turning it on or off
 * moves nothing. Off, it shows the weekdays' time, which the weekend takes then. While the switch
 * can't turn on (`missing` names the days it needs), the field's room says why.
 */
export function WeekendTime({
  checked,
  children,
  className,
  missing = null,
  onCheckedChange,
  readOnly,
}: {
  checked: boolean;
  children: (on: boolean) => React.ReactNode;
  className?: string;
  missing?: MissingDays | null;
  onCheckedChange: (checked: boolean) => void;
  readOnly?: boolean;
}) {
  const t = useExtracted();
  const switchId = useId();
  const reasonId = useId();
  const missingDayReason = useMissingDayReason();
  const disabled = missing !== null;

  return (
    <div className="flex flex-col gap-3" data-slot="weekend-time">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <label
          className={cn(disabled ? "text-muted-foreground" : "cursor-pointer", className)}
          htmlFor={switchId}
        >
          {t({
            description: "A switch to study a different amount of time a day on weekends.",
            message: "Different time on weekends",
          })}
        </label>
        <Switch
          aria-describedby={missing ? reasonId : undefined}
          checked={checked && !disabled}
          disabled={disabled}
          id={switchId}
          onCheckedChange={onCheckedChange}
          readOnly={readOnly}
        />
      </div>

      {missing ? (
        <p className="text-muted-foreground -mt-3 min-h-14 text-sm text-pretty" id={reasonId}>
          {missingDayReason(missing)}
        </p>
      ) : (
        children(checked)
      )}
    </div>
  );
}
