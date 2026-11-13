"use client";

import { useExtracted } from "next-intl";
import { TimeSelect } from "../../_components/daily-time-picker";
import { WEEKDAY_GRID_CLASS, WeekdayToggle } from "../../_components/weekday-toggle";
import { WeekendTime } from "../../_components/weekend-time";

const DAYS_PER_WEEK = 7;

/** Sunday is 0, as the plan numbers weekdays. */
export const EVERY_DAY = Array.from({ length: DAYS_PER_WEEK }, (_, day) => day);

const MONDAY = 1;
const SATURDAY = 6;

const WEEKDAYS = EVERY_DAY.filter((day) => day >= MONDAY && day < SATURDAY);

/**
 * A new goal's every-day week was never chosen, so the question opens on Monday to Friday unless
 * someone chose fewer days.
 */
export function getStartingDays(goalDays: number[]): number[] {
  return goalDays.length > 0 && goalDays.length < DAYS_PER_WEEK ? goalDays : WEEKDAYS;
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
  onChange,
  onCheckedChange,
}: {
  checked: boolean;
  minutes: number;
  onChange: (minutes: number) => void;
  onCheckedChange: (checked: boolean) => void;
}) {
  const t = useExtracted();

  return (
    <WeekendTime
      checked={checked}
      className="text-sm font-medium"
      onCheckedChange={onCheckedChange}
    >
      <TimeSelect label={t("Time on weekends")} onChange={onChange} value={minutes} />
    </WeekendTime>
  );
}
