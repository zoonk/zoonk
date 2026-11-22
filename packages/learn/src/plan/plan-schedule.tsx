"use client";

import { isWeekend } from "@zoonk/core/plans/week-shape";
import { cn } from "@zoonk/ui/lib/utils";
import { WEEKDAYS_FROM_MONDAY } from "@zoonk/utils/calendar-day";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";
import { DailyTimePicker, TimeSelect } from "../_components/daily-time-picker";
import { TimeAnswer } from "../_components/time-answer";
import { WeekdayGrid, WeekdayToggle } from "../_components/weekday-toggle";
import { WeekendTime, getMissingDays } from "../_components/weekend-time";
import { useGoalDateValues } from "../_utils/iso-date";
import { getSuggestedMinutes, getTimeLine } from "../_utils/time-answer";
import { usePlanScreen } from "./plan-context";
import { MoveDateSwitch, useCanMoveDate } from "./plan-coverage";
import { getEditorSectionId } from "./plan-editor-sections";
import { PlanFinish } from "./plan-finish";
import { ChooseFocus, useCanChooseFocus } from "./plan-focus";
import { FullCourseSwitch } from "./plan-full-course";
import { usePlanChange } from "./use-plan-change";
import { useTappedChoice } from "./use-tapped-choice";
import { useTimeToCover } from "./use-time-to-cover";

/** Asked when the editor opens, never on loading the page: it plans the goal at many times. */
function useTimeAnswer(dated: boolean) {
  const { answered, find, state } = useTimeToCover();
  const ask = useEffectEvent(() => void find());

  useEffect(() => {
    if (dated && state.status === "idle") {
      ask();
    }
  }, [dated, state.status]);

  return {
    answered,
    failed: state.status === "failed" || state.status === "building",
    retry: () => void find(),
  };
}

/**
 * While the schedule's change saves, its place says the plan is updating: the suggestion shown
 * may be for days no longer picked.
 */
function DailyCoverage({
  answer,
  minutes,
  onMoving,
  onUseTime,
  planChange,
}: {
  answer: ReturnType<typeof useTimeAnswer>;
  minutes: number;
  onMoving: (moving: boolean) => void;
  onUseTime: (minutes: number) => void;
  planChange: PlanChange;
}) {
  const t = useExtracted();
  const goalDate = useGoalDateValues();
  const { goal, plan } = usePlanScreen();
  const pending = planChange.isPending;
  const canChooseFocus = useCanChooseFocus();
  const canMoveDate = useCanMoveDate();
  const { feasibility, schedule } = plan;

  if (!feasibility?.deadline || !schedule.targetDate) {
    return <PlanFinish pending={pending} />;
  }

  const date = {
    estimated: schedule.targetDateEstimated,
    isoDate: schedule.targetDate,
    namedMonth: schedule.targetDateNamedMonth,
  };

  const line = getTimeLine({
    advice: null,
    askFailed: false,
    dated: true,
    findFailed: answer.failed,
    found: answer.answered,
    hasDays: true,
    minutes,
  });

  return (
    <div aria-busy={pending} className="grid text-sm">
      {pending && (
        <p aria-live="polite" className="text-muted-foreground col-start-1 row-start-1">
          {t("Working out the time your goal needs…")}
        </p>
      )}

      <div
        className={cn(
          "[&_button]:min-h-control col-start-1 row-start-1 flex flex-col gap-2 *:min-h-0",
          pending && "invisible",
        )}
      >
        {/* Planned again, the learner's own time covers it all (set-aside lessons come back), so it
            says so. */}
        {plan.fitOffer?.fits ? (
          <p className="text-muted-foreground">
            {t({
              description:
                'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
              message:
                "{dateKind, select, month {Your time covers everything by {date}} other {Your time covers everything by {date}}}",
              values: goalDate(date),
            })}
          </p>
        ) : (
          <TimeAnswer
            date={date}
            exam={goal.kind === "exam"}
            line={line}
            minutes={minutes}
            onRetry={answer.retry}
            onUseOffer={onUseTime}
          />
        )}

        <div className="flex flex-wrap items-center gap-2 empty:hidden">
          {canMoveDate && <MoveDateSwitch onMoving={onMoving} planChange={planChange} />}
          {canChooseFocus && <ChooseFocus />}
        </div>
      </div>
    </div>
  );
}

type PlanChange = ReturnType<typeof usePlanChange>;

function useWeekShape() {
  const { plan } = usePlanScreen();
  return plan.schedule.shape;
}

function DailyMinutes({
  moving,
  onMoving,
  planChange,
  weekendOn,
}: {
  moving: boolean;
  onMoving: (moving: boolean) => void;
  planChange: PlanChange;
  weekendOn: boolean;
}) {
  const { change } = planChange;
  const isPending = planChange.isPending || moving;
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const shape = useWeekShape();
  const current = shape.weekdays;
  const time = useTappedChoice(current);
  const answer = useTimeAnswer(plan.schedule.targetDate !== null);

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
    <div className="flex flex-col gap-2" id={getEditorSectionId("time")}>
      <DailyTimePicker
        disabled={isPending}
        label={t("Daily study time")}
        minutes={time.shown}
        onChange={setMinutes}
        saves
        suggested={getSuggestedMinutes(answer.answered)}
        titled
      />

      <DailyCoverage
        answer={answer}
        minutes={current}
        onMoving={onMoving}
        onUseTime={setMinutes}
        planChange={planChange}
      />
    </div>
  );
}

function StudyDays({ planChange: { change, isPending } }: { planChange: PlanChange }) {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const { weekdayMinutes } = plan.schedule;
  const shape = useWeekShape();
  const tapped = useTappedChoice<{ studies: boolean; weekday: number } | null>(null);

  const minutesFor = (weekday: number) =>
    shape.weekend !== null && isWeekend(weekday) ? shape.weekend : shape.weekdays;

  const weekdays = WEEKDAYS_FROM_MONDAY.map((weekday) => ({
    studies: (weekdayMinutes[weekday] ?? 0) > 0,
    weekday,
  }));

  const studyCount = weekdays.filter((day) => day.studies).length;

  return (
    <fieldset className="flex flex-col gap-2" id={getEditorSectionId("days")}>
      <legend className="mb-2 text-sm font-medium">{t("Study days")}</legend>
      <WeekdayGrid>
        {weekdays.map((day) => (
          <WeekdayToggle
            // The last study day can't be turned off: a plan needs at least one.
            disabled={isPending || (day.studies && studyCount === 1)}
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
            weekday={day.weekday}
          />
        ))}
      </WeekdayGrid>
    </fieldset>
  );
}

function WeekendMinutes({
  checked,
  onCheckedChange,
  planChange: { change, isPending },
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  planChange: PlanChange;
}) {
  const shape = useWeekShape();
  const current = shape.weekend ?? shape.weekdays;
  const weekend = useTappedChoice(current);

  const setWeekend = (minutes: number) =>
    change(
      [{ kind: "setWeekdayMinutes", minutes, weekdays: shape.weekendDays }],
      weekend.pick(minutes),
    );

  return (
    <WeekendTime
      checked={checked}
      className="text-sm font-medium"
      missing={getMissingDays([...shape.weekdayDays, ...shape.weekendDays])}
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
      {(label) => (
        <TimeSelect
          disabled={isPending}
          label={label}
          onChange={(minutes) => void setWeekend(minutes)}
          saves
          value={weekend.shown}
        />
      )}
    </WeekendTime>
  );
}

export function PlanSchedule() {
  const shape = useWeekShape();
  const planChange = usePlanChange();
  const [weekendChoice, setWeekendChoice] = useState<boolean | null>(null);
  const weekendOn = weekendChoice ?? shape.weekend !== null;
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
      <FullCourseSwitch />
    </>
  );
}
