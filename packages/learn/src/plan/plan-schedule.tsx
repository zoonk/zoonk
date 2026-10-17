"use client";

import { MAX_DAILY_MINUTES } from "@zoonk/core/plans/time-advice-contract";
import { getWeekShape, isWeekend } from "@zoonk/core/plans/week-shape";
import { Button } from "@zoonk/ui/components/button";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { WeekdayToggle } from "../_components/weekday-toggle";
import { WeekendTime } from "../_components/weekend-time";
import { useFormatDuration } from "../_utils/time-format";
import { ChoiceList } from "../onboarding/choice-list";
import { MINUTE_OPTIONS } from "../onboarding/steps/daily-minutes";
import { usePlanScreen } from "./plan-context";
import { CoveredSentence, MoveDateSwitch, usePlanCoverage, useTimeEnough } from "./plan-coverage";
import { getEditorSectionId } from "./plan-editor-sections";
import { PlanFailedMessage } from "./plan-failed-message";
import { ChooseFocus, useCanChooseFocus } from "./plan-focus";
import { usePlanChange } from "./use-plan-change";
import { useTappedChoice } from "./use-tapped-choice";
import {
  type TimeToCoverAnswer,
  readTimeToCover,
  useTimeToCover,
  useTimeToCoverTexts,
} from "./use-time-to-cover";

const DAYS_PER_WEEK = 7;

/**
 * Choices are onboarding's presets, and always include the learner's own daily time, even an
 * unusual one, and the time Find found (`found`): it was planned, so it's exact, and it shows as
 * it is (1 hr 25 min) rather than as the preset above it, which more time can cover less with (a
 * mock can take a study day).
 */
function getMinuteChoices(current: number, found?: number | null): number[] {
  const times = found ? [...MINUTE_OPTIONS, current, found] : [...MINUTE_OPTIONS, current];
  return [...new Set(times)].toSorted((a, b) => a - b);
}

/** The find answer of the plan as it is now, in what it says about daily time. */
function useFindAnswer(): TimeToCoverAnswer | null {
  const { answered } = useTimeToCover();
  return answered && readTimeToCover(answered);
}

/** Where the editor moves focus once Find answers, since the Find button that had it is gone. */
type FindFocus = {
  /** The time chips, to focus the one the answer marks. */
  chips: React.RefObject<HTMLDivElement | null>;
  /** The answer itself, when nothing below can take focus. */
  line: React.RefObject<HTMLDivElement | null>;
  /** "Move your date to cover everything", for a goal the most time doesn't cover. */
  move: React.RefObject<HTMLButtonElement | null>;
  /** The actions under the answer: moving the date, choosing where to focus. */
  actions: React.RefObject<HTMLDivElement | null>;
};

/**
 * Moves focus once this editor's Find answers: to the chip of the time found, so Space picks it;
 * to Move your date, when it's the one way that covers everything; to the most time's chip for an
 * exam; or, when no time covers more, to the first action below. `ask` marks that this editor
 * asked, so an answer found elsewhere (the Plan's card) moves nothing.
 */
function useFocusFindAnswer({ choices, refs }: { choices: number[]; refs: FindFocus }) {
  const { goal } = usePlanScreen();
  const { answered, state } = useTimeToCover();
  const asked = useRef(false);

  useEffect(() => {
    if (!asked.current || state.status === "pending") {
      return;
    }

    asked.current = false;

    if (!answered) {
      return;
    }

    const answer = readTimeToCover(answered);
    const radios = refs.chips.current?.querySelectorAll<HTMLElement>('[role="radio"]');
    const chip = (minutes: number) => radios?.[choices.indexOf(minutes)] ?? null;
    const firstAction = refs.actions.current?.querySelector<HTMLElement>("button") ?? null;

    const target =
      answer.kind === "covers"
        ? chip(answer.minutes)
        : answer.kind === "more" && goal.kind !== "exam" && answered.fittingDate
          ? refs.move.current
          : answer.kind === "more"
            ? chip(answer.minutes)
            : firstAction;

    (target ?? refs.line.current)?.focus();
  }, [answered, choices, goal.kind, refs, state.status]);

  return () => {
    asked.current = true;
  };
}

/**
 * "Find the time that covers everything", where it answers (a polite live region, always there):
 * the button while nothing's found, the answer in its place once found, or why it couldn't be
 * found, with Try again in the button's own place, so focus stays on it.
 */
function FindLine({ canFind, line, onAsk }: { canFind: boolean; line: FindFocus["line"]; onAsk: () => void }) {
  const { goal, plan } = usePlanScreen();
  const texts = useTimeToCoverTexts();
  const { answered, find, state } = useTimeToCover();
  const pending = state.status === "pending";
  const retry = state.status === "failed" || state.status === "building";

  const ask = () => {
    onAsk();
    void find();
  };

  const answer = answered && readTimeToCover(answered);

  return (
    <div
      aria-live="polite"
      className="flex flex-col gap-2 empty:hidden focus-visible:outline-none"
      ref={line}
      role="status"
      tabIndex={-1}
    >
      {answer?.kind === "covers" && answered?.targetDate && (
        <p className="font-semibold">
          {texts.covers({
            minutes: answer.minutes,
            targetDate: answered.targetDate,
            targetDateNamedMonth: answered.targetDateNamedMonth,
          })}
        </p>
      )}

      {answer?.kind === "more" && <p className="font-semibold">{texts.more(answer)}</p>}

      {answer?.kind === "more" && goal.kind !== "exam" && answered?.fittingDate && (
        <p>
          {texts.fittingDate({
            dailyMinutes: plan.schedule.dailyMinutes,
            fittingDate: answered.fittingDate,
          })}
        </p>
      )}

      {answer?.kind === "none" && <p>{texts.none(MAX_DAILY_MINUTES)}</p>}

      {retry && <p>{state.status === "building" ? texts.building : texts.failed}</p>}

      {!answer && (canFind || retry) && (
        <Button
          aria-busy={pending || undefined}
          className="self-start"
          disabled={pending}
          focusableWhenDisabled
          key="find"
          onClick={ask}
          size="sm"
          variant="outline"
        >
          {pending && <Spinner aria-hidden="true" data-icon="inline-start" role="presentation" />}
          {retry ? texts.tryAgain : texts.find}
        </Button>
      )}

      {pending && <span className="sr-only">{texts.finding}</span>}
    </div>
  );
}

/**
 * What the chosen time covers, under the presets, so each change shows its effect right away: the
 * whole goal, or what it leaves lighter, exactly as the plan has it; then Find, which plans the
 * goal at each daily time when the learner asks (never for the page), and the other ways: moving
 * a goal's date, choosing where to focus. Nothing for a plan without a date, which covers
 * everything at any pace. Studying everything is chosen with the date, above it (see `PlanDate`).
 * While a change saves, the old plan's coverage would describe a time no longer picked, so its
 * place says the new one is being worked out, keeping its height.
 */
function DailyCoverage({
  canFind,
  onAsk,
  pending,
  refs,
}: {
  canFind: boolean;
  onAsk: () => void;
  pending: boolean;
  refs: FindFocus;
}) {
  const t = useExtracted();
  const { goal, plan } = usePlanScreen();
  const coverage = usePlanCoverage();
  const canChooseFocus = useCanChooseFocus();

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
            <FindLine canFind={canFind} line={refs.line} onAsk={onAsk} />
            <div className="flex flex-wrap items-center gap-2 empty:hidden" ref={refs.actions}>
              {goal.kind !== "exam" && <MoveDateSwitch ref={refs.move} />}
              {canChooseFocus && <ChooseFocus />}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">
            {t("Covers your whole goal.")}
          </p>
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
 * The time of a study weekday, as onboarding's presets. Once Find answers, the time it found says
 * "Covers everything" under it, or, when no time does, the most time a day says what it covers;
 * none is picked for the learner. While the weekend has its own time (`weekendOn`), it changes the
 * weekdays alone, so the weekend keeps what the learner gave it; otherwise every study day moves
 * with it. The tapped preset shows picked while its change saves (see `useTappedChoice`); another
 * tap waits for it.
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
  const texts = useTimeToCoverTexts();
  const shape = useWeekShape();
  const timeEnough = useTimeEnough();
  const answer = useFindAnswer();
  const current = shape.weekdays;
  const time = useTappedChoice(current);
  const choices = getMinuteChoices(current, answer?.kind === "covers" ? answer.minutes : null);
  const chips = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const move = useRef<HTMLButtonElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const [refs] = useState<FindFocus>(() => ({ actions, chips, line, move }));
  const onAsk = useFocusFindAnswer({ choices, refs });

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

      <div aria-busy={isPending} className="aria-busy:opacity-80" ref={chips}>
        <ChoiceList
          choices={choices.map((minutes) => ({
            description: (answer && texts.note(answer, minutes)) ?? undefined,
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

      <DailyCoverage
        canFind={current < MAX_DAILY_MINUTES && !timeEnough}
        onAsk={onAsk}
        pending={isPending}
        refs={refs}
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
        {getMinuteChoices(current).map((minutes) => (
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
