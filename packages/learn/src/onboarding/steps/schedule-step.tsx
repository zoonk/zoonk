"use client";

import { type GoalView } from "@zoonk/core/goals/contract";
import { type PlanTimeAdvice, getRecommendedTime } from "@zoonk/core/plans/time-advice-contract";
import { isWeekend } from "@zoonk/core/plans/week-shape";
import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { BigQuantity } from "../../_components/big-quantity";
import { useFormatDuration } from "../../_utils/time-format";
import { type GenerationRun } from "../../generation/generation-run";
import { type Choice, ChoiceList } from "../choice-list";
import { PlanReceipt, PlanReceiptChips } from "../plan-receipt";
import { AdviceSentence } from "./advice-sentence";
import { MINUTE_OPTIONS } from "./daily-minutes";
import { FullCourseToggle } from "./full-course-toggle";
import { StepForm } from "./step-form";
import {
  EVERY_DAY,
  WeekDisclosure,
  WeekdayToggles,
  WeekendMinutes,
  getStartingDays,
} from "./study-week";
import { TimeEstimatePanel, TimeEstimateSection } from "./time-estimate";
import {
  type AdviceAnswer,
  type StudyWeek,
  getEstimate,
  getPickedShare,
  getWeekAdvice,
  hasEstimate,
  toStudyWeek,
  useTimeAdvice,
} from "./use-time-advice";
import { isRunStopped } from "./wait-run";

/** Adds a time to the chips when it isn't one of them, in order. */
function withOption(options: number[], minutes: number): number[] {
  return options.includes(minutes) ? options : [...options, minutes].toSorted((a, b) => a - b);
}

/**
 * The time chips: the usual amounts, with the recommended time in place of the closest one when
 * it isn't one of them, so the row keeps its size; the learner's own pick always stays (a time
 * picked on a course's page may be none of them).
 */
function getMinuteOptions({
  picked,
  recommended,
}: {
  picked: number;
  recommended: number | null;
}): number[] {
  if (recommended === null || MINUTE_OPTIONS.includes(recommended)) {
    return withOption([...MINUTE_OPTIONS], picked);
  }

  const closest = MINUTE_OPTIONS.reduce((best, option) =>
    Math.abs(option - recommended) < Math.abs(best - recommended) ? option : best,
  );

  const options =
    closest === picked
      ? [...MINUTE_OPTIONS, recommended]
      : MINUTE_OPTIONS.map((option) => (option === closest ? recommended : option));

  return withOption(
    options.toSorted((a, b) => a - b),
    picked,
  );
}

function useMinuteChoices({
  current,
  picked,
  recommended,
}: {
  /** The recommended time is the one for the days shown, not the last week's (see `ScheduleStep`). */
  current: boolean;
  picked: string;
  recommended: number | null;
}): Choice<string>[] {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const options = getMinuteOptions({ picked: Number(picked), recommended });

  return options.map((value) => ({
    description: current && value === recommended ? t("Recommended") : undefined,
    label: formatDuration(value),
    value: String(value),
  }));
}

/**
 * The time to recommend: the time that studies the whole goal in depth by its date, or, when no
 * daily time does, the most time a day.
 */
function getRecommended(advice: PlanTimeAdvice | null): number | null {
  return advice ? (getRecommendedTime(advice)?.dailyMinutes ?? null) : null;
}

function MinutesReadout({ minutes }: { minutes: number }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (
    <p className="flex items-baseline justify-between gap-3">
      <BigQuantity className="text-5xl">{formatDuration(minutes)}</BigQuantity>
      <span className="text-muted-foreground font-mono text-sm">{t("per day")}</span>
    </p>
  );
}

/**
 * How much time a day and on which days. It comes after placement, once the plan knows what the
 * learner already knows, so it recommends the time the plan needs to study the whole goal in depth
 * by its date, in the week they pick (its days, and the weekend's own time, which counts too): the
 * same number the plan shows next. The goal's facts lead (as chips, in the page's aside beside it
 * from 72rem), then the time picked, large, the presets under it and the recommendation under
 * them, and the estimate: what the time picked covers by the date, which follows every pick at
 * once, so the learner decides with the number in front of them. The days and the weekend's time
 * stay one tap away. It opens on the goal's starting pick (the time a course's page had picked,
 * or one from the goal's size) and on weekdays, and only the learner moves the pick: the
 * recommended time is marked when the plan says it, never picked for them, so nothing changes
 * under them while they read. Without a date there's nothing to cover by, so there's no estimate.
 */
export function ScheduleStep({
  dated,
  exam = false,
  getTimeAdvice,
  goal,
  onAnswer,
  pending,
  recommendedMinutes,
  run,
}: {
  /** The goal has a date (its own, or its exam's): the plan says the time that covers it. */
  dated: boolean;
  /** An exam: the learner can also choose to study everything, even after it. */
  exam?: boolean;
  /**
   * The goal's daily time from its plan in this week, and what the time picked covers; null when
   * it couldn't be read.
   */
  getTimeAdvice: (week: StudyWeek & { dailyMinutes: number }) => Promise<PlanTimeAdvice | null>;
  /** The goal so far, which leads the screen. */
  goal: GoalView;
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
  /**
   * The time the question opens on: the time a course's page had picked, or one from how big the
   * goal is and how soon its date is.
   */
  recommendedMinutes: number;
  /** The run building the plan, when the host follows it: a stopped one waits for its "Try again". */
  run: GenerationRun | null;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const [minutes, setMinutes] = useState(String(recommendedMinutes));
  const [weekendMinutes, setWeekendMinutes] = useState<string | null>(null);
  const [days, setDays] = useState(() => getStartingDays(goal.studyDays));
  const [answer, setAnswer] = useState<AdviceAnswer | null>(null);
  const [fullCourse, setFullCourse] = useState(false);
  // The time is only said to be recommended for the week it was asked for: Marcos saw 6 days'
  // 1h 10min recommended with 5 days picked, which needed 1h 25min.
  const recommended = getRecommended(answer?.advice.ready ? answer.advice : null);
  const studiesOnWeekends = days.some((day) => isWeekend(day));
  const weekend = studiesOnWeekends ? weekendMinutes : null;
  const week = toStudyWeek({ days, minutes, weekend });
  const advice = getWeekAdvice({ answer, week });
  const choices = useMinuteChoices({ current: advice !== null, picked: minutes, recommended });
  const pickedShare = getPickedShare({ advice, answer, minutes: Number(minutes) });

  const asking = useTimeAdvice({
    answer,
    dated,
    getAdvice: getTimeAdvice,
    known: pickedShare.known,
    minutes: Number(minutes),
    onAnswer: setAnswer,
    stopped: isRunStopped(run),
    week,
  });

  const estimate = getEstimate({ advice, answer, pickedShare, status: asking.status });
  const estimateProps = { ...estimate, minutes: Number(minutes), onRetry: asking.restart };
  const showsEstimate = dated && hasEstimate({ estimate, pickedShare, status: asking.status });

  const weekly = days.reduce(
    (total, day) => total + Number(isWeekend(day) && weekend ? weekend : minutes),
    0,
  );

  return (
    <StepForm
      canContinue={days.length > 0}
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
      rail={
        <>
          {showsEstimate && <TimeEstimateSection {...estimateProps} />}
          <PlanReceipt goal={goal} />
        </>
      }
      title={t("How much time can you study each day?")}
    >
      <PlanReceiptChips className="min-[72rem]:hidden" goal={goal} />

      <div className="flex flex-col gap-4">
        <MinutesReadout minutes={Number(minutes)} />

        <ChoiceList
          choices={choices}
          label={t("Minutes a day")}
          onChange={setMinutes}
          value={minutes}
          variant="chips"
        />

        <p aria-live="polite" className="text-muted-foreground text-sm text-pretty">
          <AdviceSentence
            advice={advice}
            onRetry={asking.restart}
            readingNotice={answer?.advice.readingNotice ?? false}
            status={asking.status}
          />
        </p>
      </div>

      {showsEstimate && <TimeEstimatePanel {...estimateProps} />}

      <WeekDisclosure
        summary={t("{days, plural, one {# day} other {# days}} · {time} a week", {
          days: days.length,
          time: formatDuration(weekly),
        })}
      >
        <WeekdayToggles days={days} onChange={setDays} />

        {studiesOnWeekends && (
          <WeekendMinutes
            choices={choices}
            minutes={weekendMinutes}
            onChange={setWeekendMinutes}
            weekdayMinutes={minutes}
          />
        )}
      </WeekDisclosure>

      {exam && <FullCourseToggle checked={fullCourse} onCheckedChange={setFullCourse} />}
    </StepForm>
  );
}
