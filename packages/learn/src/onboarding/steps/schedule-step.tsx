"use client";

import { type GoalView } from "@zoonk/core/goals/contract";
import { type PlanTimeAdvice, type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { isWeekend } from "@zoonk/core/plans/week-shape";
import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useFormatDuration } from "../../_utils/time-format";
import { type GenerationRun } from "../../generation/generation-run";
import { type FindStatus, findPickedChip, findTimeChip } from "../../plan/plan-coverage";
import {
  type TimeToCoverAnswer,
  getOfferedMinutes,
  readTimeToCover,
  useTimeToCoverTexts,
} from "../../plan/use-time-to-cover";
import { type Choice } from "../choice-list";
import { PlanReceipt, PlanReceiptChips } from "../plan-receipt";
import { AdviceSentence } from "./advice-sentence";
import { CoverEverything, FULL_COURSE_ID, getShownShare } from "./cover-everything";
import { MINUTES_ID, ScheduleTimeChoices, getTimeChoices } from "./daily-minutes";
import { FinishEstimate } from "./finish-estimate";
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
  getFullCourseEnd,
  getPickedShare,
  getWeekAdvice,
  hasEstimate,
  keepsFullCourse,
  toFindWeek,
  toStudyWeek,
  useTimeAdvice,
  useWeekTimeToCover,
} from "./use-time-advice";
import { isRunStopped } from "./wait-run";

function useMinuteChoices({ found, picked }: { found: PlanTimeToCover | null; picked: number }) {
  const texts = useTimeToCoverTexts();
  const formatDuration = useFormatDuration();
  const answer = found && readTimeToCover(found);
  const options = getTimeChoices(picked, getOfferedMinutes(answer));

  return {
    choices: options.map((value) => ({
      description: (answer && texts.note(answer, value)) ?? undefined,
      label: formatDuration(value),
      value: String(value),
    })),
    options,
  };
}

function useWeekendChoices({
  minutes,
  weekend,
}: {
  minutes: number;
  weekend: string | null;
}): Choice<string>[] {
  const formatDuration = useFormatDuration();
  const options = getTimeChoices(minutes, weekend === null ? null : Number(weekend));

  return options.map((value) => ({ label: formatDuration(value), value: String(value) }));
}

const FIND_LINE_ID = "onboarding-find";

function findAnswerTarget({
  answer,
  minutes,
  options,
}: {
  answer: TimeToCoverAnswer;
  minutes: HTMLElement | null;
  options: number[];
}): HTMLElement | null {
  const offered = getOfferedMinutes(answer);

  if (offered === null) {
    return document.querySelector<HTMLElement>(`#${FULL_COURSE_ID} [role="switch"]`);
  }

  return findTimeChip({ choices: options, container: minutes, minutes: offered });
}

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

    const minutes = document.querySelector<HTMLElement>(`#${MINUTES_ID}`);

    (
      findAnswerTarget({ answer: readTimeToCover(found), minutes, options }) ??
      findPickedChip(minutes) ??
      document.querySelector<HTMLElement>(`#${FIND_LINE_ID}`)
    )?.focus();
  }, [found, options, status]);

  return () => {
    asked.current = true;
  };
}

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
  dated: boolean;
  exam?: boolean;
  findTimeToCover: (week: StudyWeek) => Promise<PlanTimeToCover | null>;
  getTimeAdvice: (week: StudyWeek & { dailyMinutes: number }) => Promise<PlanTimeAdvice | null>;
  goal: GoalView;
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
  recommendedMinutes: number;
  run: GenerationRun | null;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const [minutes, setMinutes] = useState(String(recommendedMinutes));
  const [weekendMinutes, setWeekendMinutes] = useState<string | null>(null);
  const [days, setDays] = useState(() => getStartingDays(goal.studyDays));
  const [answer, setAnswer] = useState<AdviceAnswer | null>(null);
  // Each rebuild of the plan (an exam's notice reading landed) makes what Find found before stale.
  const [build, setBuild] = useState(0);
  const [fullCourse, setFullCourse] = useState(false);
  const studiesOnWeekends = days.some((day) => isWeekend(day));
  const weekend = studiesOnWeekends ? weekendMinutes : null;
  const week = toStudyWeek({ days, fullCourse: exam && fullCourse, minutes, weekend });
  const advice = getWeekAdvice({ answer, week });

  const findWeek = toFindWeek({ days, weekend });

  const finder = useWeekTimeToCover({
    findTimeToCover,
    key: JSON.stringify({ build, findWeek }),
    week: findWeek,
  });

  const found = answer?.advice.ready === false ? null : finder.found;
  const { choices, options } = useMinuteChoices({ found, picked: Number(minutes) });
  const weekendChoices = useWeekendChoices({ minutes: Number(minutes), weekend: weekendMinutes });
  const askFocus = useFocusFound({ found, options, status: finder.status });
  const pickedShare = getPickedShare({ advice, answer, found, minutes: Number(minutes) });
  const studiesEverything = exam && keepsFullCourse({ checked: fullCourse, pickedShare });

  const asking = useTimeAdvice({
    answer,
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

  const planReady =
    answer?.advice.ready === true || (asking.status !== "polling" && !isRunStopped(run));

  const estimateProps = { ...estimate, minutes: Number(minutes), onRetry: asking.restart };
  const showsEstimate = dated && hasEstimate({ estimate, pickedShare, status: asking.status });
  const share = getShownShare(estimate);

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
          fullCourse: exam ? studiesEverything : undefined,
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

      <ScheduleTimeChoices choices={choices} minutes={minutes} onChange={setMinutes} />

      {!dated && (
        <FinishEstimate
          advice={pickedShare.known ? advice : null}
          onRetry={asking.restart}
          status={asking.status}
          stopped={isRunStopped(run)}
          studyDays={days.length}
        />
      )}

      {showsEstimate && <TimeEstimatePanel {...estimateProps} />}

      <CoverEverything
        exam={exam}
        fullCourse={fullCourse}
        fullCourseEnd={getFullCourseEnd({ advice, answer, minutes: Number(minutes) })}
        minutes={Number(minutes)}
        onFullCourseChange={setFullCourse}
        share={share}
        studiesEverything={studiesEverything}
      >
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
      </CoverEverything>

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
    </StepForm>
  );
}
