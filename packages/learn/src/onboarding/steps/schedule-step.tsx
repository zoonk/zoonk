"use client";

import { type PlanTimeAdvice, getRecommendedTime } from "@zoonk/core/plans/time-advice-contract";
import { isWeekend } from "@zoonk/core/plans/week-shape";
import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { WeekdayToggle } from "../../_components/weekday-toggle";
import { WeekendTime } from "../../_components/weekend-time";
import { useFormatDuration } from "../../_utils/time-format";
import { type GenerationRun } from "../../generation/generation-run";
import { type Choice, ChoiceList } from "../choice-list";
import { AdviceSentence } from "./advice-sentence";
import { FullCourseToggle } from "./full-course-toggle";
import { StepForm } from "./step-form";
import {
  type AdviceAnswer,
  type StudyWeek,
  getWeekAdvice,
  toStudyWeek,
  useTimeAdvice,
} from "./use-time-advice";
import { isRunStopped } from "./wait-run";

/** From a short habit to a full study day for a big exam: the plan takes up to 4 hours. */
const MINUTE_OPTIONS = ["15", "30", "45", "60", "90", "120", "180", "240"].map(Number);
const DAYS_PER_WEEK = 7;
const EVERY_DAY = Array.from({ length: DAYS_PER_WEEK }, (_, day) => day);

/**
 * The time chips: the usual amounts, with the recommended time in place of the closest one when
 * it isn't one of them, so the row keeps its size; the learner's own pick always stays.
 */
function getMinuteOptions({
  picked,
  recommended,
}: {
  picked: number | null;
  recommended: number | null;
}): number[] {
  if (recommended === null || MINUTE_OPTIONS.some((option) => option === recommended)) {
    return [...MINUTE_OPTIONS];
  }

  const closest = MINUTE_OPTIONS.reduce((best, option) =>
    Math.abs(option - recommended) < Math.abs(best - recommended) ? option : best,
  );

  const options =
    closest === picked
      ? [...MINUTE_OPTIONS, recommended]
      : MINUTE_OPTIONS.map((option) => (option === closest ? recommended : option));

  return options.toSorted((a, b) => a - b);
}

function useMinuteChoices({
  current,
  picked,
  recommended,
}: {
  /** The recommended time is the one for the days shown, not the last week's (see `ScheduleStep`). */
  current: boolean;
  picked: string | null;
  recommended: number | null;
}): Choice<string>[] {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const options = getMinuteOptions({ picked: picked ? Number(picked) : null, recommended });

  return options.map((value) => ({
    description: current && value === recommended ? t("Recommended") : undefined,
    label: formatDuration(value),
    value: String(value),
  }));
}

/** The option closest to the goal's first pick, so a pick between two options still lands. */
function getFirstPick(minutes: number): string {
  return String(
    MINUTE_OPTIONS.reduce((best, option) =>
      Math.abs(option - minutes) < Math.abs(best - minutes) ? option : best,
    ),
  );
}

/**
 * The time to recommend: the time that studies the whole goal in depth by its date, or, when no
 * daily time does, the most time a day.
 */
function getRecommended(advice: PlanTimeAdvice | null): number | null {
  return advice ? (getRecommendedTime(advice)?.dailyMinutes ?? null) : null;
}

function WeekdayToggles({
  days,
  onChange,
}: {
  days: number[];
  onChange: (days: number[]) => void;
}) {
  const t = useExtracted();

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-base font-semibold">{t("Which days?")}</legend>
      <div className="flex justify-between gap-1.5">
        {EVERY_DAY.map((day) => (
          <WeekdayToggle
            className={cn(
              "size-11 rounded-full text-sm font-semibold",
              "aria-pressed:bg-foreground aria-pressed:text-background",
            )}
            display="narrow"
            key={day}
            onPressedChange={(next) =>
              onChange(
                next
                  ? [...days, day].toSorted((a, b) => a - b)
                  : days.filter((item) => item !== day),
              )
            }
            pressed={days.includes(day)}
            variant="outline"
            weekday={day}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** Saturday and Sunday's own time, in the same chips as the rest of the week. */
function WeekendMinutes({
  choices,
  minutes,
  onChange,
  weekdayMinutes,
}: {
  choices: Choice<string>[];
  minutes: string | null;
  onChange: (minutes: string | null) => void;
  /** Where the weekend's own time starts when it's switched on. */
  weekdayMinutes: string;
}) {
  const t = useExtracted();

  return (
    <WeekendTime
      checked={minutes !== null}
      className="text-base font-semibold"
      onCheckedChange={(checked) => onChange(checked ? weekdayMinutes : null)}
    >
      {minutes !== null && (
        <ChoiceList
          choices={choices}
          label={t("Minutes on weekends")}
          numberKeys={false}
          onChange={onChange}
          value={minutes}
          variant="chips"
        />
      )}
    </WeekendTime>
  );
}

/**
 * How much time a day and on which days. It comes after placement, once the plan knows what the
 * learner already knows, so it recommends the time the plan needs to study the whole goal in depth
 * by its date, in the week they pick (its days, and the weekend's own time, which counts too): the
 * same number the plan shows next. That time comes picked until the learner picks one; less is
 * theirs to choose, and the plan then says what it covers. Without a date there's nothing to cover
 * by, so a starting pick from the goal's size comes picked instead, claiming nothing.
 */
export function ScheduleStep({
  dated,
  exam = false,
  getTimeAdvice,
  onAnswer,
  pending,
  recommendedMinutes,
  run,
}: {
  /** The goal has a date (its own, or its exam's): the plan says the time that covers it. */
  dated: boolean;
  /** An exam: the learner can also choose to study everything, even after it. */
  exam?: boolean;
  /** The goal's daily time from its plan, in this week; null when it couldn't be read. */
  getTimeAdvice: (week: StudyWeek) => Promise<PlanTimeAdvice | null>;
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
  /** A starting pick from how big the goal is and how soon its date is, until the plan says. */
  recommendedMinutes: number;
  /** The run building the plan, when the host follows it: a stopped one waits for its "Try again". */
  run: GenerationRun | null;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const [picked, setPicked] = useState<string | null>(null);
  const [weekendMinutes, setWeekendMinutes] = useState<string | null>(null);
  const [days, setDays] = useState<number[]>(EVERY_DAY);
  const [answer, setAnswer] = useState<AdviceAnswer | null>(null);
  const [fullCourse, setFullCourse] = useState(false);
  // While another week is asked about, the last answer's time stays picked until the new one
  // comes, so the pick doesn't jump, but it's only said to be recommended for the week it was
  // asked for: Marcos saw 6 days' 1h 10min recommended with 5 days picked, which needed 1h 25min.
  const recommended = getRecommended(answer?.advice.ready ? answer.advice : null);
  const minutes = picked ?? String(recommended ?? getFirstPick(recommendedMinutes));
  const studiesOnWeekends = days.some((day) => isWeekend(day));
  const weekend = studiesOnWeekends ? weekendMinutes : null;
  const week = toStudyWeek({ days, minutes, weekend });
  const advice = getWeekAdvice({ answer, week });
  const choices = useMinuteChoices({ current: advice !== null, picked, recommended });

  const asking = useTimeAdvice({
    answer,
    dated,
    getAdvice: getTimeAdvice,
    onAnswer: setAnswer,
    stopped: isRunStopped(run),
    week,
  });

  const weekly = days.reduce(
    (total, day) => total + Number(isWeekend(day) && weekend ? weekend : minutes),
    0,
  );

  return (
    <StepForm
      canContinue={days.length > 0}
      description={
        <span aria-live="polite">
          <AdviceSentence
            advice={advice}
            onRetry={asking.restart}
            readingNotice={answer?.advice.readingNotice ?? false}
            status={asking.status}
          />
        </span>
      }
      onContinue={() =>
        onAnswer({
          dailyMinutes: Number(minutes),
          fullCourse: exam ? fullCourse : undefined,
          question: "schedule",
          studyDays: days.length === EVERY_DAY.length ? undefined : days,
          timeZone: getLocalTimeZone(),
          weekendMinutes: weekend ? Number(weekend) : undefined,
        })
      }
      pending={pending}
      title={t("How much time can you study each day?")}
    >
      <ChoiceList
        choices={choices}
        label={t("Minutes a day")}
        onChange={setPicked}
        value={minutes}
        variant="chips"
      />

      <WeekdayToggles days={days} onChange={setDays} />

      {studiesOnWeekends && (
        <WeekendMinutes
          choices={choices}
          minutes={weekendMinutes}
          onChange={setWeekendMinutes}
          weekdayMinutes={minutes}
        />
      )}

      <p aria-live="polite" className="text-muted-foreground text-sm">
        {t("{days, plural, one {# day} other {# days}} · {time} a week", {
          days: days.length,
          time: formatDuration(weekly),
        })}
      </p>

      {exam && <FullCourseToggle checked={fullCourse} onCheckedChange={setFullCourse} />}
    </StepForm>
  );
}
