"use client";

import { isWeekend } from "@zoonk/core/plans/week-shape";
import { WEEKDAYS_FROM_MONDAY } from "@zoonk/utils/calendar-day";
import { useExtracted } from "next-intl";
import { TimeSelect } from "../../_components/daily-time-picker";
import { WEEKDAY_GRID_CLASS, WeekdayToggle } from "../../_components/weekday-toggle";
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
      <div className={WEEKDAY_GRID_CLASS}>
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
      </div>
    </fieldset>
  );
}

export function WeekendMinutes({
  checked,
  minutes,
  missing,
  onChange,
  onCheckedChange,
  weekdayMinutes,
}: {
  checked: boolean;
  minutes: number;
  missing: React.ComponentProps<typeof WeekendTime>["missing"];
  onChange: (minutes: number) => void;
  onCheckedChange: (checked: boolean) => void;
  weekdayMinutes: number;
}) {
  const t = useExtracted();

  return (
    <WeekendTime
      checked={checked}
      className="text-sm font-medium"
      missing={missing}
      onCheckedChange={onCheckedChange}
    >
      {(on) => (
        <TimeSelect
          disabled={!on}
          label={t("Time on weekends")}
          onChange={onChange}
          value={on ? minutes : weekdayMinutes}
        />
      )}
    </WeekendTime>
  );
}
