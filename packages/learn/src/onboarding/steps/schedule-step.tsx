"use client";

import { getExamDocument } from "@zoonk/core/exams/document";
import { type GoalView } from "@zoonk/core/goals/contract";
import { type PlanReadiness } from "@zoonk/core/plans/time-advice-contract";
import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { Button } from "@zoonk/ui/components/button";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { DailyTimePicker } from "../../_components/daily-time-picker";
import { type GoalDate, TimeAnswer } from "../../_components/time-answer";
import { getFullTimeNote, getMarkedTimes, getOffer } from "../../_utils/time-answer";
import { type GenerationFirstLesson, type GenerationRun } from "../../generation/generation-run";
import { type OnboardingActions } from "../onboarding-actions";
import { OnboardingQuestionShown } from "../onboarding-clock";
import { PlanReceipt, PlanReceiptChips } from "../plan-receipt";
import { FullCourseToggle } from "./full-course-toggle";
import { type LibraryCourseLink, PlanWait } from "./plan-wait";
import { type GoalsTogether, keepsFullCourse, toPickedMinutes, waitsToSave } from "./schedule-time";
import { StepForm } from "./step-form";
import { EVERY_DAY, WeekdayToggles, WeekendMinutes } from "./study-week";
import {
  type Schedule,
  type ScheduleActions,
  type ScheduleDraft,
  useSchedule,
} from "./use-schedule";
import {
  WAITING_RUN,
  getNoticeStop,
  getPlanWait,
  getWaitRun,
  isPlanMade,
  isRunStopped,
} from "./wait-run";

const FULL_COURSE_ID = "onboarding-full-course";

function getGoalDate(schedule: Schedule): GoalDate | null {
  const shown = schedule.found.found ?? schedule.found.last;

  return schedule.dated && shown?.targetDate
    ? { isoDate: shown.targetDate, namedMonth: shown.targetDateNamedMonth }
    : null;
}

function getScheduleAnswer({
  exam,
  schedule,
}: {
  exam: boolean;
  schedule: Schedule;
}): OnboardingAnswerInput | null {
  const { days, weekend } = schedule.week;

  if (schedule.minutes === null) {
    return null;
  }

  return {
    dailyMinutes: schedule.minutes,
    fullCourse: exam
      ? keepsFullCourse({ checked: schedule.fullCourse, line: schedule.line })
      : undefined,
    question: "schedule",
    studyDays: days.length === EVERY_DAY.length ? undefined : days,
    timeZone: getLocalTimeZone(),
    weekendMinutes: weekend ?? undefined,
  };
}

function ScheduleTime({
  exam,
  onChangeDate,
  pending,
  schedule,
}: {
  exam: boolean;
  onChangeDate: () => void;
  pending: boolean;
  schedule: Schedule;
}) {
  const t = useExtracted();
  const { found, minutes, setPicked, shown } = schedule;
  const marked = getMarkedTimes(found.found);

  return (
    <div className="flex flex-col gap-2">
      <DailyTimePicker
        full={marked.full}
        label={t("Time a day")}
        minutes={minutes}
        titled
        onChange={(next) =>
          setPicked(
            toPickedMinutes({
              first: found.first,
              found: found.found ?? found.last,
              minutes: next,
            }),
          )
        }
        stale={schedule.stale}
        suggested={marked.suggested}
      />

      <TimeAnswer
        action={
          <Button
            className="self-start"
            disabled={pending}
            focusableWhenDisabled
            onClick={onChangeDate}
            type="button"
            variant="link"
          >
            {schedule.dated
              ? t({
                  description:
                    "A link under the daily study time that opens the question about the goal's date, to change it.",
                  message: "Change date",
                })
              : t({
                  description:
                    "A link under the daily study time that opens the question about the goal's date, for a goal with none yet.",
                  message: "Choose a date",
                })}
          </Button>
        }
        date={getGoalDate(schedule)}
        exam={exam}
        line={shown.line}
        minutes={minutes}
        note={getFullTimeNote({
          found: shown.found,
          line: shown.line,
          studiesEveryDay: schedule.week.days.length === EVERY_DAY.length,
        })}
        offer={getOffer({ found: shown.found, line: shown.line, minutes })}
        onRetry={found.failed ? found.covering.restart : schedule.timeAdvice.restart}
        onUseOffer={(offer) =>
          setPicked(toPickedMinutes({ first: found.first, found: found.found, minutes: offer }))
        }
        split={schedule.split}
        updating={shown.updating}
      />
    </div>
  );
}

function ExamFullCourse({ schedule }: { schedule: Schedule }) {
  const { advice, fullCourse, minutes } = schedule;
  const { line } = schedule.shown;
  const date = getGoalDate(schedule);
  const short = line.kind === "share" || line.kind === "focus";

  if (!date || !(short || keepsFullCourse({ checked: fullCourse, line }))) {
    return null;
  }

  const end =
    advice?.fullCourseEndDate && minutes !== null
      ? {
          dailyMinutes: minutes,
          endDate: advice.fullCourseEndDate,
          targetDate: date.isoDate,
          targetDateNamedMonth: date.namedMonth,
        }
      : null;

  return (
    <FullCourseToggle
      checked={fullCourse}
      end={end}
      id={FULL_COURSE_ID}
      onCheckedChange={schedule.setFullCourse}
    />
  );
}

function ScheduleWeek({
  recommendedMinutes,
  schedule,
}: {
  recommendedMinutes: number;
  schedule: Schedule;
}) {
  const { minutes, week } = schedule;

  return (
    <div className="flex flex-col gap-3">
      <OnboardingQuestionShown step="schedule" />
      <WeekdayToggles days={week.days} onChange={week.setDays} />

      {week.studiesOnWeekends && (
        <WeekendMinutes
          checked={week.weekendOn}
          minutes={week.weekendPicked ?? minutes ?? recommendedMinutes}
          onChange={week.setWeekendPicked}
          onCheckedChange={week.setWeekendOn}
        />
      )}
    </div>
  );
}

export function ScheduleStep({
  dated,
  draft,
  exam = false,
  findTimeToCover,
  firstLesson,
  getTimeAdvice,
  goal,
  lessonHref,
  library,
  onAnswer,
  onChangeDate,
  pending,
  planReadiness,
  readWarmUp,
  recommendedMinutes,
  run,
  together,
}: ScheduleActions & {
  dated: boolean;
  draft: ScheduleDraft | null;
  exam?: boolean;
  firstLesson: GenerationFirstLesson | null;
  goal: GoalView;
  lessonHref: (lessonId: string) => string;
  library: LibraryCourseLink | null;
  onAnswer: (input: OnboardingAnswerInput) => void;
  onChangeDate: (draft: ScheduleDraft) => void;
  pending: boolean;
  planReadiness: PlanReadiness;
  readWarmUp: OnboardingActions["readWarmUp"];
  recommendedMinutes: number;
  run: GenerationRun | null;
  together: GoalsTogether;
}) {
  const t = useExtracted();

  const schedule = useSchedule({
    actions: { findTimeToCover, getTimeAdvice },
    dated,
    draft,
    exam,
    goal,
    paused: isRunStopped(run),
    planMade: isPlanMade(run),
    recommendedMinutes,
    together,
  });

  const wait = getPlanWait({ gate: schedule.gate, opened: planReadiness, run });

  return (
    <PlanWait
      firstLesson={firstLesson}
      lessonHref={lessonHref}
      library={library}
      next="timeQuestion"
      notice={{
        document: getExamDocument(goal),
        lastNotice: false,
        stopped: getNoticeStop({ poll: schedule.gate, run }),
      }}
      readWarmUp={readWarmUp}
      run={getWaitRun({ poll: schedule.gate, run: run ?? WAITING_RUN })}
      wait={wait}
    >
      <StepForm
        canContinue={schedule.week.days.length > 0 && schedule.minutes !== null}
        continueLabel={t("See your plan")}
        onContinue={() => {
          const answer = getScheduleAnswer({ exam, schedule });

          if (answer) {
            onAnswer(answer);
          }
        }}
        pending={pending || waitsToSave({ line: schedule.line, picked: schedule.picked })}
        rail={<PlanReceipt goal={goal} />}
        title={t("How much time can you study each day?")}
      >
        <PlanReceiptChips className="min-[72rem]:hidden" goal={goal} />
        {/* The days decide the time, and what the time covers arrives last, so nothing above it moves. */}
        <ScheduleWeek recommendedMinutes={recommendedMinutes} schedule={schedule} />
        <ScheduleTime
          exam={exam}
          onChangeDate={() => onChangeDate(schedule.draft)}
          pending={pending}
          schedule={schedule}
        />
        {exam && <ExamFullCourse schedule={schedule} />}
      </StepForm>
    </PlanWait>
  );
}
