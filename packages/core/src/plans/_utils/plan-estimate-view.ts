import { readScheduledAnswers } from "../../learner/facts/scheduled-answers";
import { type PlanView } from "../plan-view-contract";
import { fromIsoDate, toIsoDate } from "../planner/plan-calendar";
import { type WritingWork, listRemainingWriting } from "../planner/writing-schedule";
import { getDatedFinish, getFinishDisplay, getSavedCourseFinish } from "./course-finish";
import { type PlanReadContext } from "./plan-read-projection";
import { type PlanSummary } from "./plan-summary";

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

  if (!schedule?.length) {
    return [];
  }

  const attempts = await readScheduledAnswers(goal.userId, goal.id);
  const keys = new Set(schedule.flatMap(({ tasks }) => tasks.map(({ taskKey }) => taskKey)));

  return listRemainingWriting({
    attempts:
      state.settings.skippedAreas.length > 0
        ? attempts.filter(({ taskKey }) => keys.has(taskKey))
        : attempts,
    schedule,
    today: toIsoDate(today),
  });
}

function readEstimateFinish({
  dated,
  fullCourseEndDate,
  summary,
}: {
  dated: boolean;
  fullCourseEndDate: string | null;
  summary: PlanSummary | null;
}) {
  if (!summary) {
    return null;
  }

  if (fullCourseEndDate) {
    return getDatedFinish({
      date: fullCourseEndDate,
      today: fromIsoDate(summary.basis.layoutStudyDay),
    });
  }

  return dated ? null : getSavedCourseFinish(summary);
}

export function buildEstimateView({
  context,
  summary,
  writing,
}: {
  context: PlanReadContext;
  summary: PlanSummary | null;
  writing: readonly WritingWork[];
}): PlanView["estimate"] {
  const pace = context.state.settings.pace;
  const dated = context.goal.targetDate !== null;
  const fullCourse = context.goal.kind === "exam" && context.state.settings.fullCourse;
  const fullCourseEndDate = fullCourse ? (summary?.advice.fullCourseEndDate ?? null) : null;
  const forecast = readEstimateFinish({ dated, fullCourseEndDate, summary });

  const { items } = context;
  const totalHours = context.plan.estimateHours ?? 0;

  const remainingMinutes = items
    .filter((item) => item.status === "todo")
    .reduce((sum, item) => sum + (item.minutes ?? 0), 0);

  const remainingWriting = writing.reduce((sum, entry) => sum + entry.minutes, 0);

  return {
    ...getFinishDisplay(forecast),
    endDate: dated ? (fullCourseEndDate ?? getShownEnd(context)) : (forecast?.date ?? null),
    fullCourseEndDate,
    pace: pace ? { factor: pace.factor, source: pace.source } : null,
    remainingHours: toHours(remainingMinutes + remainingWriting),
    totalHours: Math.round(totalHours * 10) / 10,
  };
}
