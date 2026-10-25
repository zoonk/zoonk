"use client";

import { getWeekShape, isWeekend } from "@zoonk/core/plans/week-shape";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { WeekdayToggle } from "../_components/weekday-toggle";
import { WeekendTime } from "../_components/weekend-time";
import { useFormatGoalDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { ChoiceList } from "../onboarding/choice-list";
import { OtherTimeSelect, TimeSelect, getTimeChoices } from "../onboarding/steps/daily-minutes";
import { usePlanScreen } from "./plan-context";
import {
  CoveredSentence,
  MoveDateSwitch,
  useCanMoveDate,
  usePlanCoverage,
  useTimeEnough,
} from "./plan-coverage";
import { getEditorSectionId } from "./plan-editor-sections";
import { PlanFailedMessage } from "./plan-failed-message";
import {
  FIND_ACTIONS_ID,
  FindLine,
  MOVE_DATE_ID,
  useFindAnswer,
  useFocusFindAnswer,
} from "./plan-find-line";
import { ChooseFocus, useCanChooseFocus } from "./plan-focus";
import { usePlanChange } from "./use-plan-change";
import { useTappedChoice } from "./use-tapped-choice";
import { useTimeToCoverTexts } from "./use-time-to-cover";

const DAYS_PER_WEEK = 7;

/**
 * What the chosen time covers, under the presets, so each change shows its effect right away: the
 * whole goal, or what it leaves lighter, exactly as the plan has it; then Find, which plans the
 * goal at each daily time when the learner asks (never for the page), and the other ways: moving
 * a goal's date, choosing where to focus. Nothing for a plan without a date, which covers
 * everything at any pace. Studying everything is chosen with the date, above it (see `PlanDate`).
 * While the schedule's change saves, the old plan's coverage would describe a time no longer
 * picked, so its place says the new one is being worked out, keeping its height.
 */
function DailyCoverage({
  canFind,
  onAsk,
  onMoving,
  planChange,
}: {
  canFind: boolean;
  onAsk: () => void;
  onMoving: (moving: boolean) => void;
  planChange: PlanChange;
}) {
  const t = useExtracted();
  const formatGoalDate = useFormatGoalDate();
  const { plan } = usePlanScreen();
  const pending = planChange.isPending;
  const coverage = usePlanCoverage();
  const canChooseFocus = useCanChooseFocus();
  const canMoveDate = useCanMoveDate();

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
              {/* Her own time covers it all once planned again (lessons set aside come back): say so,
                  as the Plan's suggestion does, rather than what the plan as it stands leaves out. */}
              {plan.fitOffer?.fits && plan.schedule.targetDate ? (
                <p>
                  {t("Your time covers everything by {date}", {
                    date: formatGoalDate({
                      isoDate: plan.schedule.targetDate,
                      namedMonth: plan.schedule.targetDateNamedMonth,
                      style: "long",
                    }),
                  })}
                </p>
              ) : (
                <CoveredSentence
                  coreFits={coverage.coreFits}
                  coveredShare={coverage.coveredShare}
                  deepensMostAsked={coverage.deepensMostAsked}
                  measure={coverage.measure}
                />
              )}
            </div>
            <FindLine canFind={canFind} onAsk={onAsk} />
            <div className="flex flex-wrap items-center gap-2 empty:hidden" id={FIND_ACTIONS_ID}>
              {canMoveDate && (
                <MoveDateSwitch id={MOVE_DATE_ID} onMoving={onMoving} planChange={planChange} />
              )}
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
 * The time of a study weekday, as onboarding asks it: the presets, with the learner's own time
 * among them, even an unusual one, and "Other time…" for any other, which joins them. Once Find
 * answers, the time it found joins them too, as it is (1 hr 25 min: it was planned, so it's exact,
 * where the preset above it can cover less, as a mock can take a study day), and says "Covers
 * everything"; none is picked for the learner. While the weekend has its own time (`weekendOn`),
 * it changes the weekdays alone, so the weekend keeps what the learner gave it; otherwise every
 * study day moves with it. The time picked shows picked while its change saves (see
 * `useTappedChoice`); another pick waits for it.
 */
function DailyMinutes({
  moving,
  onMoving,
  planChange,
  weekendOn,
}: {
  /** Move your date is finding or saving its date: the chips wait, as for any change. */
  moving: boolean;
  onMoving: (moving: boolean) => void;
  planChange: PlanChange;
  weekendOn: boolean;
}) {
  const { change } = planChange;
  const isPending = planChange.isPending || moving;
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const texts = useTimeToCoverTexts();
  const shape = useWeekShape();
  const timeEnough = useTimeEnough();
  const answer = useFindAnswer();
  const current = shape.weekdays;
  const time = useTappedChoice(current);
  const found = answer?.kind === "covers" ? answer.minutes : null;
  const choices = getTimeChoices(current, time.shown, found);
  const onAsk = useFocusFindAnswer(choices);

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

      <div className="flex flex-col gap-2">
        <div aria-busy={isPending} className="aria-busy:opacity-80">
          <ChoiceList
            choices={choices.map((minutes) => ({
              description: (answer && texts.note(answer, minutes)) ?? undefined,
              label: formatDuration(minutes),
              value: String(minutes),
            }))}
            label={t("Time a day")}
            manualActivation
            numberKeys={false}
            onChange={(value) => setMinutes(Number(value))}
            value={String(time.shown)}
            variant="chips"
          />
        </div>

        <OtherTimeSelect
          disabled={isPending}
          label={t("Other time a day")}
          minutes={time.shown}
          onPick={setMinutes}
        />
      </div>

      <DailyCoverage
        canFind={!timeEnough}
        onAsk={onAsk}
        onMoving={onMoving}
        planChange={planChange}
      />
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
 * Saturday and Sunday's own time: switched on, the weekend gets its time from every time a day,
 * in one select; switched off, it goes back to the weekdays' time. Only for a week studied both on
 * weekdays and on the weekend. The time picked shows while it saves.
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
      <TimeSelect
        disabled={isPending}
        label={t("Time on weekends")}
        onChange={(minutes) => void setWeekend(minutes)}
        value={weekend.shown}
      />
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
  // While Move your date finds its date or saves it, the other settings wait, as for any change.
  const [moving, setMoving] = useState(false);
  const schedule = { ...planChange, isPending: planChange.isPending || moving };

  return (
    <>
      <DailyMinutes
        moving={moving}
        onMoving={setMoving}
        planChange={planChange}
        weekendOn={weekendOn}
      />
      <StudyDays planChange={schedule} />
      <WeekendMinutes
        checked={weekendOn}
        onCheckedChange={setWeekendChoice}
        planChange={schedule}
      />
      {planChange.failed && <PlanFailedMessage />}
    </>
  );
}
