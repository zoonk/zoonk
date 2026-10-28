import { type PlanView } from "../plan-view-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanReadContext } from "./plan-read-projection";
import { readPlanSummary } from "./plan-summary";

export const MINUTES_PER_HOUR = 60;

function toHours(minutes: number): number {
  return Math.round((minutes / MINUTES_PER_HOUR) * 10) / 10;
}

/**
 * The day the plan the Plan shows ends: its last item's, or the end of its time after the exam
 * when that's later, as the build that saved it says (see `PlanFeasibility.endDate`). Read from
 * the shown plan, so the change that saved it and the read after it say the same day: the read's
 * own rebuild laid an exam's time after it out again and ended it a week sooner.
 */
function getShownEnd(context: PlanReadContext): string | null {
  const dates = context.items.flatMap((item) =>
    item.scheduledFor ? [toIsoDate(item.scheduledFor)] : [],
  );

  const afterExam = context.phases.find((phase) => phase.kind === "afterExam")?.endDate;
  return [...dates, ...(afterExam ? [afterExam] : [])].toSorted().at(-1) ?? null;
}

/**
 * The plan's size and end (see `getShownEnd`), which for an exam studying everything is when the
 * learner finishes it all after the exam once the plan holds all of it (see `getFullCourseEnd`). A
 * plan without a graph (a seeded one) keeps the estimate it was saved with.
 */
export function buildEstimateView({ context }: { context: PlanReadContext }): PlanView["estimate"] {
  const pace = context.state.settings.pace;
  const endDate = getShownEnd(context);
  const fullCourse = context.goal.kind === "exam" && context.state.settings.fullCourse;
  const { items } = context;
  const totalHours = context.plan.estimateHours ?? 0;

  const remainingMinutes = items
    .filter((item) => item.status === "todo")
    .reduce((sum, item) => sum + (item.minutes ?? 0), 0);

  return {
    endDate,
    fullCourseEndDate: fullCourse
      ? (readPlanSummary({
          plan: { ...context.plan, userId: context.goal.userId },
          value: context.plan.summary,
        })?.advice.fullCourseEndDate ?? null)
      : null,
    pace,
    remainingHours: toHours(remainingMinutes),
    totalHours: Math.round(totalHours * 10) / 10,
  };
}
