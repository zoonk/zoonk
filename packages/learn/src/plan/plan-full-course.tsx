"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { Switch } from "@zoonk/ui/components/switch";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { useFormatGoalDate, useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { usePlanScreen } from "./plan-context";
import { PlanFailedMessage } from "./plan-failed-message";
import { usePlanChange } from "./use-plan-change";

/**
 * Studying everything at the learner's own pace: when they would finish it all at their time, and
 * the change that does it. Any goal with a date but an exam can always drop it (`setTargetDate`
 * null) for the whole course; an exam keeps its date and goes on after it (`setFullCourse`), which
 * changes something only while its time doesn't cover everything by then. Null when there's
 * nothing to choose: no date, a quick explanation, or an exam whose time covers it all.
 */
export function useFullCourse() {
  const { goal, plan } = usePlanScreen();
  const { feasibility, schedule } = plan;
  const isExam = goal.kind === "exam";

  const endDate =
    feasibility?.fullCourseEndDate ?? (isExam ? null : (plan.estimate.endDate ?? null));

  if (goal.kind === "explain" || !schedule.targetDate || !endDate) {
    return null;
  }

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

/** When the learner would finish everything, against the exam's date or as the plan's end. */
export function useFullCourseText() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const formatGoalDate = useFormatGoalDate();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();
  const time = formatDuration(plan.schedule.dailyMinutes);

  return {
    /**
     * "At 3 h a day, you finish in March 2027, after the exam on November 8, 2026": the exam's
     * year is named beside the finish month's, so November 2027 never reads as the exam's month.
     */
    finish: (course: FullCourse): string => {
      const month = formatDate(course.endDate, "month");

      return course.isExam
        ? t("At {time} a day, you finish in {month}, after the exam on {date}.", {
            date: formatGoalDate({
              isoDate: course.targetDate,
              namedMonth: course.targetDateNamedMonth,
              style: "longYear",
            }),
            month,
            time,
          })
        : t("At {time} a day, you finish in {month}.", { month, time });
    },
    /** What changes besides the end: nothing before the exam, or the deadline comes off. */
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

/**
 * "Keep studying after the exam" in the plan editor, for an exam whose time doesn't cover it by its
 * date: on, what doesn't fit goes on after the exam, and it says when everything ends; off, what
 * doesn't fit by the exam is left out. Each switch re-plans from today.
 */
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
    <div className="flex flex-col gap-2">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <label className="cursor-pointer text-sm font-medium" htmlFor={switchId}>
          {t("Keep studying after the exam")}
        </label>
        <Switch
          aria-describedby={descriptionId}
          checked={course.on}
          id={switchId}
          onCheckedChange={(on) => void change(course.operations(on))}
          readOnly={isPending}
        />
      </div>

      <p className="text-muted-foreground text-sm text-pretty" id={descriptionId}>
        {course.on
          ? text.finish(course)
          : t("What doesn't fit by the exam is left out of your plan.")}
      </p>

      {failed && <PlanFailedMessage />}
    </div>
  );
}
