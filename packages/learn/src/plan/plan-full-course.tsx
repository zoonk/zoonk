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

/**
 * Studying everything at the learner's own pace, and the change that does it. Any goal with a date
 * but an exam can always drop it (`setTargetDate` null) for the whole course; an exam keeps its
 * date and goes on after it (`setFullCourse`), which changes something only while its time
 * doesn't cover everything by then (`fits`, exact) or while it's on. `endDate` is when they'd
 * finish it all, only when that's the plan's own end: an exam already studying everything whose
 * plan holds all of it (a few minutes a day can leave some out even after the exam), or a goal
 * whose plan covers everything. Otherwise working it out would plan the goal again, which a page
 * never does: the "Study everything" sheet previews it once opened, and the editor's switch says it
 * once on. Null when there's nothing to choose: no date, a quick explanation, or an exam whose time
 * covers it all.
 */
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

/** When studying everything at a daily time ends, and the date it goes past. */
type Finish = {
  dailyMinutes: number;
  /** Null unless the plan studying everything holds all of it (see `useFullCourse`). */
  endDate: string | null;
  isExam: boolean;
  targetDate: string;
  targetDateNamedMonth: boolean;
};

/**
 * "At 3 h a day, you finish in March 2027, after the exam on November 8, 2026": the exam's year is
 * named beside the finish month's, so November 2027 never reads as the exam's month. Null without
 * an end date. It reads no plan, so the time step says it for the time it asked about too.
 */
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

/** When an exam studying everything at a daily time ends (see `useExamFullCourseText`). */
export type ExamFinish = Omit<Finish, "isExam">;

/**
 * What an exam studying everything does, said the same wherever it's chosen (the time step, the
 * plan editor, the reveal): when it ends and that, until the exam, what comes up most comes
 * first; while that end isn't known (null), or the plan can't hold everything even after the
 * exam, only what's sure.
 */
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

/** When the learner would finish everything, against the exam's date or as the plan's end. */
export function useFullCourseText() {
  const t = useExtracted();
  const formatGoalDate = useFormatGoalDate();
  const finishText = useFinishText();
  const examText = useExamFullCourseText();
  const { plan } = usePlanScreen();
  const { dailyMinutes } = plan.schedule;

  return {
    /** When everything ends, with the plan's own end only (see `useFullCourse`): null without it. */
    finish: (course: FullCourse): string | null => finishText({ ...course, dailyMinutes }),
    /** An exam's plan studying everything, as it stands (see `useExamFullCourseText`). */
    onExam: (course: FullCourse): string => examText({ ...course, dailyMinutes }),
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

/** Where the editor's Find sends the keyboard once no time covers an exam (see `FullCourseSwitch`). */
export const FULL_COURSE_SWITCH_ID = "plan-editor-full-course";

/**
 * "Study everything, even after the exam" in the plan editor, after Find's answer as onboarding
 * places, names and describes it, for an exam whose time doesn't cover it by its date: on, what doesn't fit goes on after the
 * exam, and it says when everything ends; off, what doesn't fit by the exam is left out. Each
 * switch re-plans from today.
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
