"use client";

import { getWeekShape, isWeekend } from "@zoonk/core/plans/week-shape";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ChangeSaveError } from "../_components/save-error";
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
import {
  FIND_ACTIONS_ID,
  FindLine,
  MOVE_DATE_ID,
  useFindAnswer,
  useFocusFindAnswer,
} from "./plan-find-line";
import { PlanFinish } from "./plan-finish";
import { ChooseFocus, useCanChooseFocus } from "./plan-focus";
import { FullCourseSwitch } from "./plan-full-course";
import { usePlanChange } from "./use-plan-change";
import { useTappedChoice } from "./use-tapped-choice";
import { getOfferedMinutes, useTimeToCoverTexts } from "./use-time-to-cover";

const DAYS_PER_WEEK = 7;

/**
 * While the schedule's change saves, its place says the new coverage is being worked out: the old
 * one would describe a time no longer picked.
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
    return <PlanFinish pending={pending} />;
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
              {/* Planned again, the learner's own time covers it all (set-aside lessons come
                  back), so it says so. */}
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

type PlanChange = ReturnType<typeof usePlanChange>;

function useWeekShape() {
  const { plan } = usePlanScreen();
  return getWeekShape(plan.schedule);
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
  const formatDuration = useFormatDuration();
  const texts = useTimeToCoverTexts();
  const shape = useWeekShape();
  const timeEnough = useTimeEnough();
  const answer = useFindAnswer();
  const current = shape.weekdays;
  const time = useTappedChoice(current);
  const choices = getTimeChoices(current, time.shown, getOfferedMinutes(answer));
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

      <FullCourseSwitch />
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

  // Sunday first, as the plan counts weekdays.
  const weekdays = Array.from({ length: DAYS_PER_WEEK }, (_, weekday) => ({
    studies: (weekdayMinutes[weekday] ?? 0) > 0,
    weekday,
  }));

  const studyCount = weekdays.filter((day) => day.studies).length;

  return (
    <fieldset className="flex flex-col gap-2" id={getEditorSectionId("days")}>
      <legend className="mb-2 text-sm font-medium">{t("Study days")}</legend>
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
      {planChange.failed && <ChangeSaveError />}
    </>
  );
}
