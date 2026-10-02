import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { fromIsoDate, toIsoDate } from "../../plans/planner/plan-calendar";
import { getExamEditionDays, readExamYear } from "./exam-edition-days";

export type ExamDay = { date: string; label: string | null; startTime: string | null };

/**
 * The exam's days, from its notice, or the goal's own date when the notice has none. `estimated`
 * days are the ones the edition most likely has, until its notice is stored.
 */
type ExamCalendar = { days: ExamDay[]; estimated: boolean; timeZone: string | null };

/**
 * When the learner's exam is: every exam day of the edition they prepare for with its start time,
 * or the goal's date for exams without one (a school test on Friday). The edition is the year the
 * learner named (ENEM 2028), or the notice's own while its days are ahead of the goal's start;
 * without a notice for it, its days are estimated from the notice's timing, as the next edition's
 * are once a notice's days all passed before the goal started.
 */
export function getExamCalendar({
  blueprint,
  goal,
}: {
  blueprint: ExamBlueprint | null;
  goal: Pick<Goal, "createdAt" | "details" | "targetDate" | "timezone">;
}): ExamCalendar {
  const edition = blueprint ? readBlueprintContent(blueprint).edition : null;
  const startedOn = toIsoDate(getGoalStartDate(goal));

  const { days, estimated } = getExamEditionDays({
    edition,
    examYear: readExamYear(goal.details),
    from: startedOn,
  });

  if (days.some((day) => day.date >= startedOn)) {
    return {
      days: days.map((day) => ({ date: day.date, label: day.label, startTime: day.startTime })),
      estimated,
      timeZone: edition?.timeZone ?? null,
    };
  }

  return {
    days: goal.targetDate
      ? [{ date: toIsoDate(goal.targetDate), label: null, startTime: null }]
      : [],
    estimated: false,
    timeZone: null,
  };
}

/** The days as UTC-midnight labels, as learner-local dates are stored. */
export function toExamDates(calendar: ExamCalendar): Date[] {
  return calendar.days.map((day) => fromIsoDate(day.date));
}

/** The learner-local day the goal started, as a UTC-midnight label like the exam's days. */
function getGoalStartDate(goal: Pick<Goal, "createdAt" | "timezone">): Date {
  return getDateInTimeZone({ date: goal.createdAt, timeZone: getAnswerTimeZone({ goal }) });
}
