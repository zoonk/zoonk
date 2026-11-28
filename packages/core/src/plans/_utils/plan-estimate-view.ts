import { readScheduledAnswers } from "../../learner/facts/scheduled-answers";
import { type PlanView } from "../plan-view-contract";
import { fromIsoDate, toIsoDate } from "../planner/plan-calendar";
import { type WritingWork, listRemainingWriting } from "../planner/writing-schedule";
import { getFinishDisplay, getFinishPrecision } from "./course-finish";
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
  const forecast = dated ? null : (summary?.selected.forecast.finish ?? null);
  const endDate = dated ? getShownEnd(context) : (forecast?.date ?? null);
  const display = getFinishDisplay(forecast);

  const precision =
    display.precision ??
    (forecast?.date && summary
      ? getFinishPrecision({
          date: fromIsoDate(forecast.date),
          today: fromIsoDate(summary.basis.layoutStudyDay),
        })
      : null);

  const fullCourse = context.goal.kind === "exam" && context.state.settings.fullCourse;
  const { items } = context;
  const totalHours = context.plan.estimateHours ?? 0;

  const remainingMinutes = items
    .filter((item) => item.status === "todo")
    .reduce((sum, item) => sum + (item.minutes ?? 0), 0);

  const remainingWriting = writing.reduce((sum, entry) => sum + entry.minutes, 0);

  return {
    ...display,
    endDate,
    fullCourseEndDate: fullCourse ? (summary?.advice.fullCourseEndDate ?? null) : null,
    pace: pace ? { factor: pace.factor, source: pace.source } : null,
    precision,
    remainingHours: toHours(remainingMinutes + remainingWriting),
    totalHours: Math.round(totalHours * 10) / 10,
  };
}
