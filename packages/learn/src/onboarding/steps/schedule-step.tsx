"use client";

import { getExamDocument } from "@zoonk/core/exams/document";
import { type GoalView } from "@zoonk/core/goals/contract";
import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { DailyTimePicker } from "../../_components/daily-time-picker";
import { type GenerationRun } from "../../generation/generation-run";
import { getFullMinutes, readTimeToCover } from "../../plan/use-time-to-cover";
import { PlanReceipt, PlanReceiptChips } from "../plan-receipt";
import { FullCourseToggle } from "./full-course-toggle";
import { NoticeReading } from "./notice-reading";
import { PlanBuilding } from "./plan-building";
import { type GoalDate, ScheduleLine } from "./schedule-line";
import {
  type GoalsTogether,
  getFullTimeNote,
  getOffer,
  getSuggestedMinutes,
  keepsFullCourse,
  toPickedMinutes,
  waitsToSave,
} from "./schedule-time";
import { StepForm } from "./step-form";
import { EVERY_DAY, WeekdayToggles, WeekendMinutes } from "./study-week";
import { type Schedule, type ScheduleActions, useSchedule } from "./use-schedule";
import { WAITING_RUN, getWaitRun, hasWaitFailed, isPlanMade, isRunStopped } from "./wait-run";

const FULL_COURSE_ID = "onboarding-full-course";

/** A run that's done leaves the time question to say the plan is still working the time out. */
function isWaiting({ gate, run }: { gate: Schedule["gate"]; run: GenerationRun | null }) {
  const last = gate.last;
  return last !== null && !last.ready && (last.readingNotice || run?.status !== "ready");
}

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

function PlanWait({
  gate,
  goal,
  run,
}: {
  gate: Schedule["gate"];
  goal: GoalView;
  run: GenerationRun | null;
}) {
  if (gate.last?.readingNotice && !hasWaitFailed({ poll: gate.status, run })) {
    return <NoticeReading document={getExamDocument(goal)} lastNotice={false} />;
  }

  return <PlanBuilding run={getWaitRun({ poll: gate, run: run ?? WAITING_RUN })} />;
}

function ScheduleTime({ exam, schedule }: { exam: boolean; schedule: Schedule }) {
  const t = useExtracted();
  const { found, line, minutes, setPicked } = schedule;

  return (
    <div className="flex flex-col gap-2">
      <DailyTimePicker
        full={found.found && getFullMinutes(readTimeToCover(found.found))}
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
        suggested={getSuggestedMinutes(found.found)}
      />

      <ScheduleLine
        date={getGoalDate(schedule)}
        exam={exam}
        line={line}
        minutes={minutes}
        note={getFullTimeNote({
          found: found.found,
          line,
          studiesEveryDay: schedule.week.days.length === EVERY_DAY.length,
        })}
        offer={getOffer({ found: found.found, line, minutes })}
        onRetry={found.failed ? found.covering.restart : schedule.timeAdvice.restart}
        onUseOffer={(offer) =>
          setPicked(toPickedMinutes({ first: found.first, found: found.found, minutes: offer }))
        }
        split={schedule.split}
      />
    </div>
  );
}

function ExamFullCourse({ schedule }: { schedule: Schedule }) {
  const { advice, fullCourse, line, minutes } = schedule;
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
  exam = false,
  findTimeToCover,
  getTimeAdvice,
  goal,
  onAnswer,
  pending,
  recommendedMinutes,
  run,
  together,
}: ScheduleActions & {
  dated: boolean;
  exam?: boolean;
  goal: GoalView;
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
  recommendedMinutes: number;
  run: GenerationRun | null;
  together: GoalsTogether;
}) {
  const t = useExtracted();

  const schedule = useSchedule({
    actions: { findTimeToCover, getTimeAdvice },
    dated,
    exam,
    goal,
    paused: isRunStopped(run),
    planMade: isPlanMade(run),
    recommendedMinutes,
    together,
  });

  if (isWaiting({ gate: schedule.gate, run })) {
    return <PlanWait gate={schedule.gate} goal={goal} run={run} />;
  }

  return (
    <StepForm
      canContinue={schedule.week.days.length > 0 && schedule.minutes !== null}
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
      <ScheduleTime exam={exam} schedule={schedule} />
      {exam && <ExamFullCourse schedule={schedule} />}
    </StepForm>
  );
}
