"use client";

import { type GoalView } from "@zoonk/core/goals/contract";
import { type PlanTimeAdvice, type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { isWeekend } from "@zoonk/core/plans/week-shape";
import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { BigQuantity } from "../../_components/big-quantity";
import { useFormatDuration } from "../../_utils/time-format";
import { type GenerationRun } from "../../generation/generation-run";
import { type FindStatus, findTimeChip } from "../../plan/plan-coverage";
import { readTimeToCover, useTimeToCoverTexts } from "../../plan/use-time-to-cover";
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
  toFindWeek,
  toStudyWeek,
  useTimeAdvice,
  useWeekTimeToCover,
} from "./use-time-advice";
import { isRunStopped } from "./wait-run";

/** Adds a time to the chips when it isn't one of them, in order. */
function withOption(options: number[], minutes: number): number[] {
  return options.includes(minutes) ? options : [...options, minutes].toSorted((a, b) => a - b);
}

/**
 * The time chips: the usual amounts and the learner's own pick (a time picked on a course's page
 * may be none of them). Once Find answers for the week shown, the time it found joins them as it
 * is (1 hr 25 min: it was planned, so it's exact) and says "Covers everything", or, when no time
 * does, the most time a day says what it covers. None is picked for the learner.
 */
function useMinuteChoices({ found, picked }: { found: PlanTimeToCover | null; picked: number }) {
  const texts = useTimeToCoverTexts();
  const formatDuration = useFormatDuration();
  const answer = found && readTimeToCover(found);
  const presets = withOption([...MINUTE_OPTIONS], picked);
  const options = answer?.kind === "covers" ? withOption(presets, answer.minutes) : presets;

  return {
    choices: options.map((value) => ({
      description: (answer && texts.note(answer, value)) ?? undefined,
      label: formatDuration(value),
      value: String(value),
    })),
    options,
  };
}

/** The weekend's own time: the usual amounts and the times picked, never the time Find found. */
function useWeekendChoices({
  minutes,
  weekend,
}: {
  minutes: number;
  weekend: string | null;
}): Choice<string>[] {
  const formatDuration = useFormatDuration();
  const picked = withOption([...MINUTE_OPTIONS], minutes);
  const options = weekend === null ? picked : withOption(picked, Number(weekend));

  return options.map((value) => ({ label: formatDuration(value), value: String(value) }));
}

/** The time chips and the line under them, where focus goes once Find answers. */
const MINUTES_ID = "onboarding-minutes";
const FIND_LINE_ID = "onboarding-find";

/**
 * Once Find answers, focus moves to the chip it marks, so Space picks it: the time that covers
 * everything, or the most time a day; when no time covers more, to the answer itself. Only when
 * this step asked (`ask`), and a failed search keeps focus on Try again, in Find's own place.
 */
function useFocusFound({
  found,
  options,
  status,
}: {
  found: PlanTimeToCover | null;
  options: number[];
  status: FindStatus;
}) {
  const asked = useRef(false);

  useEffect(() => {
    if (!asked.current || status === "pending") {
      return;
    }

    asked.current = false;

    if (!found) {
      return;
    }

    const answer = readTimeToCover(found);
    const minutes = document.querySelector<HTMLElement>(`#${MINUTES_ID}`);

    const chip =
      answer.kind === "none"
        ? null
        : findTimeChip({ choices: options, container: minutes, minutes: answer.minutes });

    (chip ?? document.querySelector<HTMLElement>(`#${FIND_LINE_ID}`))?.focus();
  }, [found, options, status]);

  return () => {
    asked.current = true;
  };
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
 * learner already knows. The goal's facts lead (as chips, in the page's aside beside it from
 * 72rem), then the time picked, large, the presets under it, and the estimate: what the time
 * picked covers by the date, exactly as the plan would have it, which follows every pick at once,
 * so the learner decides with the number in front of them. Under the presets, "Find the time that
 * covers everything" plans the goal at each daily time, in the week shown (its days, and the
 * weekend's own time, which counts too), only when the learner asks: the time it finds is marked,
 * never picked for them, so nothing changes under them while they read. The days and the weekend's
 * time stay one tap away. It opens on the goal's starting pick (the time a course's page had
 * picked, or one from the goal's size) and on weekdays. Without a date there's nothing to cover
 * by, so there's no estimate and nothing to find.
 */
export function ScheduleStep({
  dated,
  exam = false,
  findTimeToCover,
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
  /** The time that covers the goal by its date in this week, found when the learner asks. */
  findTimeToCover: (week: StudyWeek) => Promise<PlanTimeToCover | null>;
  /** What the time picked covers by the goal's date in this week; null when it couldn't be read. */
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
  // Each time the plan is built again (an exam's notice reading landed), what Find found before is
  // for the plan before it.
  const [build, setBuild] = useState(0);
  const [fullCourse, setFullCourse] = useState(false);
  const studiesOnWeekends = days.some((day) => isWeekend(day));
  const weekend = studiesOnWeekends ? weekendMinutes : null;
  const week = toStudyWeek({ days, minutes, weekend });
  const advice = getWeekAdvice({ answer, week });

  const findWeek = toFindWeek({ days, weekend });

  const finder = useWeekTimeToCover({
    findTimeToCover,
    key: JSON.stringify({ build, findWeek }),
    week: findWeek,
  });

  // While the plan is being built again, there's no answer to show.
  const found = answer?.advice.ready === false ? null : finder.found;
  const { choices, options } = useMinuteChoices({ found, picked: Number(minutes) });
  const weekendChoices = useWeekendChoices({ minutes: Number(minutes), weekend: weekendMinutes });
  const askFocus = useFocusFound({ found, options, status: finder.status });
  const pickedShare = getPickedShare({ advice, answer, found, minutes: Number(minutes) });

  const asking = useTimeAdvice({
    answer,
    dated,
    getAdvice: getTimeAdvice,
    known: pickedShare.known,
    minutes: Number(minutes),
    onAnswer: (next) => {
      if (answer?.advice.ready && !next.advice.ready) {
        setBuild((count) => count + 1);
      }

      setAnswer(next);
    },
    stopped: isRunStopped(run),
    week,
  });

  const estimate = getEstimate({ advice, answer, pickedShare, status: asking.status });
  // Built once the plan said so for any week; once asking stopped while its run goes on, Find says
  // what it finds.
  const planReady =
    answer?.advice.ready === true || (asking.status !== "polling" && !isRunStopped(run));

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

        <div id={MINUTES_ID}>
          <ChoiceList
            choices={choices}
            label={t("Minutes a day")}
            onChange={setMinutes}
            value={minutes}
            variant="chips"
          />
        </div>

        <div className="text-muted-foreground text-sm text-pretty">
          <AdviceSentence
            dated={dated}
            find={finder.status}
            found={found}
            id={FIND_LINE_ID}
            onFind={() => {
              askFocus();
              void finder.find();
            }}
            planReady={planReady}
            readingNotice={answer?.advice.readingNotice ?? false}
          />
        </div>
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
            choices={weekendChoices}
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
