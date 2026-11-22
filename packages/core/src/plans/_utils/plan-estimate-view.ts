import { readScheduledAnswers } from "../../learner/facts/scheduled-answers";
import { type PlanView } from "../plan-view-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type WritingWork, listRemainingWriting } from "../planner/writing-schedule";
import { type PlanReadContext } from "./plan-read-projection";
import { readPlanSummary } from "./plan-summary";

export const MINUTES_PER_HOUR = 60;

function toHours(minutes: number): number {
  return Math.round((minutes / MINUTES_PER_HOUR) * 10) / 10;
}

function getShownEnd(context: PlanReadContext): string | null {
  const dates = context.items.flatMap((item) =>
    item.scheduledFor ? [toIsoDate(item.scheduledFor)] : [],
  );

  const afterExam = context.phases.find((phase) => phase.kind === "afterExam")?.endDate;
  return [...dates, ...(afterExam ? [afterExam] : [])].toSorted().at(-1) ?? null;
}

export async function loadPlanWritingWork({ goal, state, today }: PlanReadContext) {
  const schedule = state.settings.writingSchedule;

  return schedule?.length
    ? listRemainingWriting({
        attempts: await readScheduledAnswers(goal.userId, goal.id),
        schedule,
        today: toIsoDate(today),
      })
    : [];
}

export function buildEstimateView({
  context,
  writing,
}: {
  context: PlanReadContext;
  writing: readonly WritingWork[];
}): PlanView["estimate"] {
  const pace = context.state.settings.pace;
  const endDate = getShownEnd(context);
  const fullCourse = context.goal.kind === "exam" && context.state.settings.fullCourse;
  const { items } = context;
  const totalHours = context.plan.estimateHours ?? 0;

  const remainingMinutes = items
    .filter((item) => item.status === "todo")
    .reduce((sum, item) => sum + (item.minutes ?? 0), 0);

  const remainingWriting = writing.reduce((sum, entry) => sum + entry.minutes, 0);

  return {
    endDate,
    fullCourseEndDate: fullCourse
      ? (readPlanSummary({
          plan: { ...context.plan, userId: context.goal.userId },
          value: context.plan.summary,
        })?.advice.fullCourseEndDate ?? null)
      : null,
    pace: pace ? { factor: pace.factor, source: pace.source } : null,
    remainingHours: toHours(remainingMinutes + remainingWriting),
    totalHours: Math.round(totalHours * 10) / 10,
  };
}
