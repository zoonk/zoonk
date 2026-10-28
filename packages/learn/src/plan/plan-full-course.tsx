"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { Switch } from "@zoonk/ui/components/switch";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { useFormatGoalDate, useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { usePlanScreen } from "./plan-context";
import { usePlanChange } from "./use-plan-change";

/** `endDate` only when it's the plan's own end: working it out otherwise would plan the goal again, which a page never does. Null when there's nothing to choose. */
export function useFullCourse() {
  const { goal, plan } = usePlanScreen();
  const { feasibility, schedule } = plan;
  const isExam = goal.kind === "exam";
  const fits = feasibility?.fits ?? false;

  if (goal.kind === "explain" || !schedule.targetDate || (isExam && fits && !schedule.fullCourse)) {
    return null;
  }

  const goalEnd = fits ? plan.estimate.endDate : null;
  const endDate = isExam ? plan.estimate.fullCourseEndDate : goalEnd;

  const operations = (on: boolean): LearnerPlanOperation[] =>
    isExam
      ? [{ fullCourse: on, kind: "setFullCourse" }]
      : [{ kind: "setTargetDate", targetDate: null }];

  return {
    endDate,
    isExam,
    on: schedule.fullCourse,
    operations,
    targetDate: schedule.targetDate,
    targetDateNamedMonth: schedule.targetDateNamedMonth,
  };
}

export type FullCourse = NonNullable<ReturnType<typeof useFullCourse>>;

type Finish = {
  dailyMinutes: number;
  endDate: string | null;
  isExam: boolean;
  targetDate: string;
  targetDateNamedMonth: boolean;
};

/** Names the exam's year beside the finish's, so November 2027 never reads as the exam's month. */
function useFinishText() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const formatGoalDate = useFormatGoalDate();
  const formatDuration = useFormatDuration();

  return function finishText({
    dailyMinutes,
    endDate,
    isExam,
    targetDate,
    targetDateNamedMonth,
  }: Finish): string | null {
    if (!endDate) {
      return null;
    }

    const month = formatDate(endDate, "month");
    const time = formatDuration(dailyMinutes);

    return isExam
      ? t("At {time} a day, you finish in {month}, after the exam on {date}.", {
          date: formatGoalDate({
            isoDate: targetDate,
            namedMonth: targetDateNamedMonth,
            style: "longYear",
          }),
          month,
          time,
        })
      : t("At {time} a day, you finish in {month}.", { month, time });
  };
}

export type ExamFinish = Omit<Finish, "isExam">;

export function useExamFullCourseText() {
  const t = useExtracted();
  const finishText = useFinishText();

  return (finish: ExamFinish | null): string => {
    const end = finish && finishText({ ...finish, isExam: true });

    return end
      ? `${end} ${t("Until the exam, what comes up most comes first.")}`
      : t("Until the exam, what comes up most comes first. What doesn't fit comes after it.");
  };
}

export function useFullCourseText() {
  const t = useExtracted();
  const formatGoalDate = useFormatGoalDate();
  const finishText = useFinishText();
  const examText = useExamFullCourseText();
  const { plan } = usePlanScreen();
  const { dailyMinutes } = plan.schedule;

  return {
    finish: (course: FullCourse): string | null => finishText({ ...course, dailyMinutes }),
    onExam: (course: FullCourse): string => examText({ ...course, dailyMinutes }),
    rule: (course: FullCourse): string =>
      course.isExam
        ? t(
            "Until the exam, nothing changes: what comes up most comes first, with mocks and the final stretch. What doesn't fit comes after it.",
          )
        : t("Your deadline of {date} comes off your plan. You can set one again anytime.", {
            date: formatGoalDate({
              isoDate: course.targetDate,
              namedMonth: course.targetDateNamedMonth,
              style: "long",
            }),
          }),
  };
}

export const FULL_COURSE_SWITCH_ID = "plan-editor-full-course";

export function FullCourseSwitch() {
  const t = useExtracted();
  const switchId = useId();
  const descriptionId = useId();
  const course = useFullCourse();
  const text = useFullCourseText();
  const { change, failed, isPending } = usePlanChange();

  if (!course?.isExam) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2" id={FULL_COURSE_SWITCH_ID}>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <label className="cursor-pointer text-sm font-medium" htmlFor={switchId}>
          {t("Study everything, even after the exam")}
        </label>
        <Switch
          aria-busy={isPending || undefined}
          aria-describedby={descriptionId}
          checked={course.on}
          id={switchId}
          onCheckedChange={(on) => void change(course.operations(on))}
          readOnly={isPending}
        />
      </div>

      <p className="text-muted-foreground text-sm text-pretty" id={descriptionId}>
        {course.on
          ? text.onExam(course)
          : t("What doesn't fit by the exam is left out of your plan.")}
      </p>

      {failed && <ChangeSaveError />}
    </div>
  );
}
