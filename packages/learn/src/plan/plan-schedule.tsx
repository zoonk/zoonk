"use client";

import { Button } from "@zoonk/ui/components/button";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { Toggle } from "@zoonk/ui/components/toggle";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { useExtracted } from "next-intl";
import { isoDateToUtc, useFormatIsoDate } from "../_utils/iso-date";
import { usePlanScreen } from "./plan-context";
import { PlanFailedMessage } from "./plan-failed-message";
import { usePlanChange } from "./use-plan-change";

const MINUTE_CHOICES = ["10", "15", "20", "30", "45", "60", "90", "120", "180", "240"] as const;
const DAYS_PER_WEEK = 7;

/** Choices always include the learner's own daily time, even an unusual one. */
function getMinuteChoices(current: number): number[] {
  return [...new Set([...MINUTE_CHOICES.map(Number), current])].toSorted((a, b) => a - b);
}

/** The Monday after this plan week, as a calendar day. */
function getNextWeekStart(weekEnd: string): string {
  return new Date(isoDateToUtc(weekEnd).getTime() + MS_PER_DAY).toISOString().slice(0, 10);
}

/** Sunday first, as the plan counts weekdays. A fixed Sunday names each day in the viewer's language. */
const SUNDAY = "2026-01-04";

function StudyDays() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const { plan } = usePlanScreen();
  const { change, isPending } = usePlanChange();
  const { dailyMinutes, weekdayMinutes } = plan.schedule;

  const weekdays = Array.from({ length: DAYS_PER_WEEK }, (_, weekday) => ({
    label: formatDate(
      new Date(isoDateToUtc(SUNDAY).getTime() + weekday * MS_PER_DAY).toISOString().slice(0, 10),
      "weekdayShort",
    ),
    studies: (weekdayMinutes[weekday] ?? 0) > 0,
    weekday,
  }));

  const studyCount = weekdays.filter((day) => day.studies).length;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{t("Study days")}</legend>
      {/* Seven equal columns keep the week on one row on a phone, whatever the day names. */}
      <div className="grid max-w-sm grid-cols-7 gap-1">
        {weekdays.map((day) => (
          <Toggle
            className="aria-pressed:bg-foreground aria-pressed:text-background h-11 min-w-0 px-0 capitalize"
            // The last study day can't be turned off: a plan needs at least one.
            disabled={isPending || (day.studies && studyCount === 1)}
            focusableWhenDisabled
            key={day.weekday}
            onPressedChange={(pressed) =>
              change([
                {
                  kind: "setWeekdayMinutes",
                  minutes: pressed ? dailyMinutes : 0,
                  weekdays: [day.weekday],
                },
              ])
            }
            pressed={day.studies}
            variant="outline"
          >
            {day.label}
          </Toggle>
        ))}
      </div>
    </fieldset>
  );
}

/** Daily time, study days and a light week: the plan's shape, each change re-planned from today. */
export function PlanSchedule() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const { plan } = usePlanScreen();
  const { change, failed, isPending } = usePlanChange();
  const nextWeek = getNextWeekStart(plan.week.endDate);
  const hasLightWeek = plan.schedule.lightWeeks.some((week) => week.startDate === nextWeek);

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("Time a day")}</span>
        <NativeSelect
          disabled={isPending}
          focusableWhenDisabled
          onChange={(event) =>
            change([{ kind: "setDailyMinutes", minutes: Number(event.target.value) }])
          }
          value={plan.schedule.dailyMinutes}
        >
          {getMinuteChoices(plan.schedule.dailyMinutes).map((minutes) => (
            <NativeSelectOption key={minutes} value={minutes}>
              {t("{minutes, number} min", { minutes })}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>

      <StudyDays />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("Light week")}</span>
        {/* The date goes in the sentence, so the button stays one short line in every language. */}
        <p className="text-muted-foreground text-sm">
          {t(
            "Half the time for the week of {date}, when life gets busy. The plan moves the rest.",
            { date: formatDate(nextWeek, "long") },
          )}
        </p>
        <Button
          className="self-start"
          disabled={isPending || hasLightWeek}
          focusableWhenDisabled
          onClick={() => change([{ kind: "addLightWeek", startDate: nextWeek }])}
          variant="outline"
        >
          {hasLightWeek ? t("Next week is light") : t("Make next week light")}
        </Button>
      </div>

      {failed && <PlanFailedMessage />}
    </div>
  );
}
