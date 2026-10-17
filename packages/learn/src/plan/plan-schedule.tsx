"use client";

import { getRecommendedTime } from "@zoonk/core/plans/time-advice-contract";
import { getWeekShape, isWeekend } from "@zoonk/core/plans/week-shape";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { WeekdayToggle } from "../_components/weekday-toggle";
import { WeekendTime } from "../_components/weekend-time";
import { useFormatDuration } from "../_utils/time-format";
import { ChoiceList } from "../onboarding/choice-list";
import { MINUTE_OPTIONS } from "../onboarding/steps/daily-minutes";
import { usePlanScreen } from "./plan-context";
import {
  CoveredSentence,
  MoveDateSwitch,
  TargetSentence,
  useFittingDateText,
  usePlanCoverage,
} from "./plan-coverage";
import { getEditorSectionId } from "./plan-editor-sections";
import { PlanFailedMessage } from "./plan-failed-message";
import { ChooseFocus, useCanChooseFocus } from "./plan-focus";
import { usePlanChange } from "./use-plan-change";
import { useTappedChoice } from "./use-tapped-choice";

const DAYS_PER_WEEK = 7;

/**
 * Choices are onboarding's presets, and always include the learner's own daily time, even an
 * unusual one, and the time the goal needs: the one that covers it whole by its date, or the most
 * time a day when none does, recommended wherever a daily time is chosen.
 */
function getMinuteChoices({
  current,
  recommended,
}: {
  current: number;
  recommended: number | null;
}): number[] {
  const extra = [current, recommended].filter((minutes) => minutes !== null);
  return [...new Set([...MINUTE_OPTIONS, ...extra])].toSorted((a, b) => a - b);
}

/**
 * What the chosen time covers, under the presets, so each change shows its effect right away: the
 * whole goal, or what it leaves lighter (the time that covers it all is the preset tagged "all in
 * depth", one tap away above); when no daily time covers it by its date, honestly what the most
 * time covers and one tap to the date the learner's time covers it all by. Nothing for a plan
 * without a date, which covers everything at any pace. Studying everything is chosen with the
 * date, above it (see `PlanDate`). While a change saves, the old plan's coverage would describe a
 * time no longer picked, so its place says the new one is being worked out, keeping its height.
 */
function DailyCoverage({ pending }: { pending: boolean }) {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const coverage = usePlanCoverage();
  const canChooseFocus = useCanChooseFocus();
  const fittingDateText = useFittingDateText();

  if (!plan.feasibility?.deadline) {
    return null;
  }

  return (
    <div aria-busy={pending} aria-live="polite" className="grid text-sm">
      {pending && (
        <p className="text-muted-foreground col-start-1 row-start-1">
          {t("Working out what your time covers…")}
        </p>
      )}

      <div className={cn("col-start-1 row-start-1 flex flex-col gap-2", pending && "invisible")}>
        {coverage ? (
          <>
            <div className="text-muted-foreground">
              <CoveredSentence
                coreFits={coverage.coreFits}
                coveredShare={coverage.coveredShare}
                deepensMostAsked={coverage.deepensMostAsked}
                measure={coverage.measure}
              />
            </div>
            {coverage.target?.kind === "more" && <TargetSentence target={coverage.target} />}
            {coverage.fittingDate && (
              <p>
                {fittingDateText({
                  dailyMinutes: plan.schedule.dailyMinutes,
                  fittingDate: coverage.fittingDate,
                })}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 empty:hidden">
              {coverage.fittingDate && <MoveDateSwitch fittingDate={coverage.fittingDate} />}
              {canChooseFocus && <ChooseFocus />}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">{t("Covers your whole goal.")}</p>
        )}
      </div>
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
 * What a preset says under its time: the time that covers everything in depth says so, the most
 * time a day when none does is recommended, the others say nothing.
 */
function usePresetNote() {
  const t = useExtracted();

  return ({
    minutes,
    target,
  }: {
    minutes: number;
    target: ReturnType<typeof getRecommendedTime> | null;
  }): string | undefined => {
    if (minutes !== target?.dailyMinutes) {
      return undefined;
    }

    return target.kind === "inDepth" ? t("all in depth") : t("recommended");
  };
}

/**
 * The time of a study weekday, as onboarding's presets: the time that covers everything in depth
 * says so under it ("all in depth"), or that it's recommended when no time does. While the
 * weekend has its own time (`weekendOn`), it changes the weekdays alone, so the weekend keeps what
 * the learner gave it; otherwise every study day moves with it. The tapped preset shows picked
 * while its change saves (see `useTappedChoice`); another tap waits for it.
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
  const presetNote = usePresetNote();
  const current = shape.weekdays;
  const time = useTappedChoice(current);
  const target = plan.feasibility && getRecommendedTime(plan.feasibility);
  const recommended = target?.dailyMinutes ?? null;

  const setMinutes = (minutes: number) => {
    if (isPending || minutes === current) {
      return;
    }

    void change(
      [
        weekendOn && shape.canDiffer
          ? { kind: "setWeekdayMinutes", minutes, weekdays: shape.weekdayDays }
          : { kind: "setDailyMinutes", minutes },
      ],
      time.pick(minutes),
    );
  };

  return (
    <div className="flex flex-col gap-3" id={getEditorSectionId("time")}>
      {/* The presets carry the name for screen readers (`label`); this is their visible title. */}
      <span aria-hidden="true" className="text-sm font-medium">
        {t("Time a day")}
      </span>

      <div aria-busy={isPending} className="aria-busy:opacity-80">
        <ChoiceList
          choices={getMinuteChoices({ current, recommended }).map((minutes) => ({
            description: presetNote({ minutes, target }),
            label: formatDuration(minutes),
            value: String(minutes),
          }))}
          label={t("Time a day")}
          numberKeys={false}
          onChange={(value) => setMinutes(Number(value))}
          value={String(time.shown)}
          variant="chips"
        />
      </div>

      <DailyCoverage pending={isPending} />
    </div>
  );
}

/**
 * One toggle a day, pressed while it's a study day. A tapped day shows its new state while its
 * change saves.
 */
function StudyDays({ planChange: { change, isPending } }: { planChange: PlanChange }) {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const { weekdayMinutes } = plan.schedule;
  const shape = useWeekShape();
  const tapped = useTappedChoice<{ studies: boolean; weekday: number } | null>(null);

  // A day back on the plan takes the time of its part of the week.
  const minutesFor = (weekday: number) =>
    shape.weekend !== null && isWeekend(weekday) ? shape.weekend : shape.weekdays;

  // Sunday first, as the plan counts weekdays.
  const weekdays = Array.from({ length: DAYS_PER_WEEK }, (_, weekday) => ({
    studies: (weekdayMinutes[weekday] ?? 0) > 0,
    weekday,
  }));

  const studyCount = weekdays.filter((day) => day.studies).length;

  return (
    <fieldset className="flex flex-col gap-2" id={getEditorSectionId("days")}>
      <legend className="mb-2 text-sm font-medium">{t("Study days")}</legend>
      {/* Seven equal columns keep the week on one row on a phone, whatever the day names. */}
      <div className="grid max-w-sm grid-cols-7 gap-1">
        {weekdays.map((day) => (
          <WeekdayToggle
            className="h-11 min-w-0 px-0 capitalize"
            // The last study day can't be turned off: a plan needs at least one.
            disabled={isPending || (day.studies && studyCount === 1)}
            display="short"
            focusableWhenDisabled
            key={day.weekday}
            onPressedChange={(pressed) =>
              change(
                [
                  {
                    kind: "setWeekdayMinutes",
                    minutes: pressed ? minutesFor(day.weekday) : 0,
                    weekdays: [day.weekday],
                  },
                ],
                tapped.pick({ studies: pressed, weekday: day.weekday }),
              )
            }
            pressed={tapped.shown?.weekday === day.weekday ? tapped.shown.studies : day.studies}
            variant="outline"
            weekday={day.weekday}
          />
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Saturday and Sunday's own time, as onboarding asks it: switched on, the weekend gets its time in
 * the same choices as the rest of the week; switched off, it goes back to the weekdays' time. Only
 * for a week studied both on weekdays and on the weekend. The time picked shows while it saves.
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
  const current = shape.weekend ?? shape.weekdays;
  const weekend = useTappedChoice(current);

  if (!shape.canDiffer) {
    return null;
  }

  const setWeekend = (minutes: number) =>
    change(
      [{ kind: "setWeekdayMinutes", minutes, weekdays: shape.weekendDays }],
      weekend.pick(minutes),
    );

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
        value={weekend.shown}
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
