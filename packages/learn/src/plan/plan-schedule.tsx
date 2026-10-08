"use client";

import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { Toggle } from "@zoonk/ui/components/toggle";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { WeekendTime } from "../_components/weekend-time";
import { isoDateToUtc, useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { usePlanScreen } from "./plan-context";
import { CoverageSwitch, CoveredSentence, TargetSentence, usePlanCoverage } from "./plan-coverage";
import { PlanFailedMessage } from "./plan-failed-message";
import { ChooseFocus, useCanChooseFocus } from "./plan-focus";
import { usePlanChange } from "./use-plan-change";
import { getWeekShape, isWeekend } from "./week-shape";

const MINUTE_CHOICES = ["10", "15", "20", "30", "45", "60", "90", "120", "180", "240"] as const;
const DAYS_PER_WEEK = 7;

/**
 * Choices always include the learner's own daily time, even an unusual one, and the time the goal
 * needs: the one that covers it whole by its date, recommended wherever a daily time is chosen.
 */
function getMinuteChoices({
  current,
  recommended,
}: {
  current: number;
  recommended: number | null;
}): number[] {
  const extra = [current, recommended].filter((minutes) => minutes !== null);
  return [...new Set([...MINUTE_CHOICES.map(Number), ...extra])].toSorted((a, b) => a - b);
}

/** Sunday first, as the plan counts weekdays. A fixed Sunday names each day in the viewer's language. */
const SUNDAY = "2026-01-04";

/**
 * What the chosen time covers, under the control, so each change shows its effect right away: the
 * whole goal, or the share it covers with the time that covers it all and one tap to switch.
 * Nothing for a plan without a date, which covers everything at any pace.
 */
function DailyCoverage({ pending }: { pending: boolean }) {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const coverage = usePlanCoverage();
  const canChooseFocus = useCanChooseFocus();

  if (!plan.feasibility?.deadline) {
    return null;
  }

  return (
    <div
      aria-busy={pending}
      aria-live="polite"
      className="flex flex-col gap-2 text-sm aria-busy:opacity-60"
    >
      {coverage ? (
        <>
          <div className="text-muted-foreground">
            <CoveredSentence
              coreFits={coverage.coreFits}
              coveredShare={coverage.coveredShare}
              measure={coverage.measure}
            />
          </div>
          {coverage.target && <TargetSentence target={coverage.target} />}
          <div className="flex flex-wrap items-center gap-2">
            {coverage.target && <CoverageSwitch target={coverage.target} />}
            {canChooseFocus && <ChooseFocus />}
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">{t("Covers your whole goal.")}</p>
      )}
    </div>
  );
}

/** The schedule's one change at a time (see `PlanSchedule`). */
type PlanChange = ReturnType<typeof usePlanChange>;

/** The plan's week split into weekdays and the weekend (see `getWeekShape`). */
function useWeekShape() {
  const { plan } = usePlanScreen();
  return getWeekShape(plan.schedule);
}

/**
 * The time of a study weekday. While the weekend has its own time (`weekendOn`), it changes the
 * weekdays alone, so the weekend keeps what the learner gave it; otherwise every study day moves
 * with it.
 */
function DailyMinutes({
  planChange: { change, isPending },
  weekendOn,
}: {
  planChange: PlanChange;
  weekendOn: boolean;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();
  const shape = useWeekShape();
  const current = shape.weekdays;
  const recommended = plan.feasibility?.recommendedMinutes ?? null;

  const setMinutes = (minutes: number) =>
    change([
      weekendOn && shape.canDiffer
        ? { kind: "setWeekdayMinutes", minutes, weekdays: shape.weekdayDays }
        : { kind: "setDailyMinutes", minutes },
    ]);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("Time a day")}</span>
        <NativeSelect
          disabled={isPending}
          focusableWhenDisabled
          onChange={(event) => setMinutes(Number(event.target.value))}
          value={current}
        >
          {getMinuteChoices({ current, recommended }).map((minutes) => (
            <NativeSelectOption key={minutes} value={minutes}>
              {/* Short enough for a phone's select; what it covers is said under it. */}
              {minutes === recommended
                ? t("{time} (recommended)", { time: formatDuration(minutes) })
                : formatDuration(minutes)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>

      <DailyCoverage pending={isPending} />
    </div>
  );
}

function StudyDays({ planChange: { change, isPending } }: { planChange: PlanChange }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const { plan } = usePlanScreen();
  const { weekdayMinutes } = plan.schedule;
  const shape = useWeekShape();

  // A day back on the plan takes the time of its part of the week.
  const minutesFor = (weekday: number) =>
    shape.weekend !== null && isWeekend(weekday) ? shape.weekend : shape.weekdays;

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
                  minutes: pressed ? minutesFor(day.weekday) : 0,
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

/**
 * Saturday and Sunday's own time, as onboarding asks it: switched on, the weekend gets its time in
 * the same choices as the rest of the week; switched off, it goes back to the weekdays' time. Only
 * for a week studied both on weekdays and on the weekend.
 */
function WeekendMinutes({
  checked,
  onCheckedChange,
  planChange: { change, isPending },
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  planChange: PlanChange;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const shape = useWeekShape();

  if (!shape.canDiffer) {
    return null;
  }

  const current = shape.weekend ?? shape.weekdays;

  const setWeekend = (minutes: number) =>
    change([{ kind: "setWeekdayMinutes", minutes, weekdays: shape.weekendDays }]);

  return (
    <WeekendTime
      checked={checked}
      className="text-sm font-medium"
      // Switched off, the weekend takes the weekdays' time: wait for a change still saving, so it
      // takes the time that change sets rather than the one before it.
      readOnly={isPending}
      onCheckedChange={(next) => {
        onCheckedChange(next);

        if (!next && shape.weekend !== null) {
          void setWeekend(shape.weekdays);
        }
      }}
    >
      <NativeSelect
        aria-label={t("Time on weekends")}
        disabled={isPending}
        focusableWhenDisabled
        onChange={(event) => setWeekend(Number(event.target.value))}
        value={current}
      >
        {getMinuteChoices({ current, recommended: null }).map((minutes) => (
          <NativeSelectOption key={minutes} value={minutes}>
            {formatDuration(minutes)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </WeekendTime>
  );
}

/**
 * Daily time, study days and the weekend's own time: the plan's shape, each change re-planned from
 * today. They save one change at a time (`planChange`), each from the plan the last one left. The
 * weekend switch answers the learner at once (`weekendChoice`), while the plan they changed is read
 * again; until they touch it, it shows whether the plan's weekend has its own time.
 */
export function PlanSchedule() {
  const shape = useWeekShape();
  const planChange = usePlanChange();
  const [weekendChoice, setWeekendChoice] = useState<boolean | null>(null);
  const weekendOn = weekendChoice ?? shape.weekend !== null;

  return (
    <>
      <DailyMinutes planChange={planChange} weekendOn={weekendOn} />
      <StudyDays planChange={planChange} />
      <WeekendMinutes
        checked={weekendOn}
        onCheckedChange={setWeekendChoice}
        planChange={planChange}
      />
      {planChange.failed && <PlanFailedMessage />}
    </>
  );
}
