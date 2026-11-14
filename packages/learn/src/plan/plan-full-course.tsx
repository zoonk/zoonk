"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { Switch } from "@zoonk/ui/components/switch";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { useFormatIsoDate } from "../_utils/iso-date";
import { usePlanScreen } from "./plan-context";
import { usePlanChange } from "./use-plan-change";

/**
 * `endDate` only when it's the plan's own end, for an exam already studying everything. A dated
 * goal's plan practices until its date, so its end without one is previewed when asked. Null when
 * there's nothing to choose.
 */
/** The one change that keeps an exam's plan going after the exam. */
export const STUDY_AFTER_EXAM: LearnerPlanOperation[] = [
  { fullCourse: true, kind: "setFullCourse" },
];

export function useFullCourse() {
  const { goal, plan } = usePlanScreen();
  const { feasibility, schedule } = plan;
  const isExam = goal.kind === "exam";
  const fits = feasibility?.fits ?? false;

  if (goal.kind === "explain" || !schedule.targetDate || (isExam && fits && !schedule.fullCourse)) {
    return null;
  }

  const endDate = isExam ? plan.estimate.fullCourseEndDate : null;

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

/** When a plan that studies past its exam ends; null while that month isn't known. */
function useFinishText() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return (endDate: string | null): string | null =>
    endDate && t("You finish in {month}.", { month: formatDate(endDate, "month") });
}

export function useFullCourseText() {
  const finishText = useFinishText();
  return { finish: (course: FullCourse): string | null => finishText(course.endDate) };
}

export function useKeepStudyingLabel(): string {
  const t = useExtracted();
  return t("Keep studying after the exam");
}

const FULL_COURSE_SWITCH_ID = "plan-editor-full-course";

export function FullCourseSwitch() {
  const switchId = useId();
  const descriptionId = useId();
  const course = useFullCourse();
  const text = useFullCourseText();
  const label = useKeepStudyingLabel();
  const { change, isPending } = usePlanChange();

  // What follows the exam is asked when its date passes; a plan that already goes on can stop here.
  if (!course?.isExam || !course.on) {
    return null;
  }

  const finish = text.finish(course);

  return (
    <div className="flex flex-col gap-2" id={FULL_COURSE_SWITCH_ID}>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <label className="cursor-pointer text-sm font-medium" htmlFor={switchId}>
          {label}
        </label>
        <Switch
          aria-busy={isPending || undefined}
          aria-describedby={finish ? descriptionId : undefined}
          checked={course.on}
          id={switchId}
          onCheckedChange={(on) => void change(course.operations(on))}
          readOnly={isPending}
        />
      </div>

      {finish && (
        <p className="text-muted-foreground text-sm text-pretty" id={descriptionId}>
          {finish}
        </p>
      )}
    </div>
  );
}
