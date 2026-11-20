"use client";

import { isWeekend } from "@zoonk/core/plans/week-shape";
import { WEEKDAYS_FROM_MONDAY } from "@zoonk/utils/calendar-day";
import { useExtracted } from "next-intl";
import { TimeSelect } from "../../_components/daily-time-picker";
import { WeekdayGrid, WeekdayToggle } from "../../_components/weekday-toggle";
import { WeekendTime } from "../../_components/weekend-time";

export const EVERY_DAY = WEEKDAYS_FROM_MONDAY;

const WEEKDAYS = EVERY_DAY.filter((day) => !isWeekend(day));

/**
 * A new goal's every-day week was never chosen, so the question opens on Monday to Friday unless
 * someone chose fewer days.
 */
export function getStartingDays(goalDays: number[]): number[] {
  return goalDays.length > 0 && goalDays.length < EVERY_DAY.length ? goalDays : WEEKDAYS;
}

export function WeekdayToggles({
  days,
  onChange,
}: {
  days: number[];
  onChange: (days: number[]) => void;
}) {
  const t = useExtracted();

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{t("Study days")}</legend>
      <WeekdayGrid>
        {EVERY_DAY.map((day) => (
          <WeekdayToggle
            key={day}
            onPressedChange={(next) =>
              onChange(
                next
                  ? [...days, day].toSorted((a, b) => a - b)
                  : days.filter((item) => item !== day),
              )
            }
            pressed={days.includes(day)}
            weekday={day}
          />
        ))}
      </WeekdayGrid>
    </fieldset>
  );
}

export function WeekendMinutes({
  checked,
  minutes,
  missing,
  onChange,
  onCheckedChange,
}: {
  checked: boolean;
  minutes: number;
  missing: React.ComponentProps<typeof WeekendTime>["missing"];
  onChange: (minutes: number) => void;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <WeekendTime
      checked={checked}
      className="text-sm font-medium"
      missing={missing}
      onCheckedChange={onCheckedChange}
    >
      {(label) => <TimeSelect label={label} onChange={onChange} value={minutes} />}
    </WeekendTime>
  );
}
