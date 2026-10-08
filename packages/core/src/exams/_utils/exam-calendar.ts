import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { fromIsoDate, toIsoDate } from "../../plans/planner/plan-calendar";
import {
  getExamEditionDays,
  getNamedMonthStart,
  readExamMonth,
  readExamYear,
} from "./exam-edition-days";

export type ExamDay = { date: string; label: string | null; startTime: string | null };

/**
 * The exam's days, from its notice, or the goal's own date when the notice has none. `estimated`
 * days are the ones the edition most likely has, until its notice is stored.
 */
type ExamCalendar = { days: ExamDay[]; estimated: boolean; timeZone: string | null };

/**
 * When the learner's exam is: every exam day of the edition they prepare for with its start time,
 * or the date the plan counts down to when the notice doesn't give it, so every screen shows the
 * plan's one date. The edition is the year the learner named (ENEM 2028), or the notice's own
 * while its days are ahead of the goal's start; without a notice for it, its days are estimated
 * from the notice's timing, as the next edition's are once a notice's days all passed before the
 * goal started. A goal date that isn't one of those days is the learner's own (a school test on
 * Friday, a sitting the notice doesn't list), or one they kept when the notice gave another.
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
  const goalDate = goal.targetDate ? toIsoDate(goal.targetDate) : null;

  const { days, estimated } = getExamEditionDays({
    edition,
    examMonth: readExamMonth(goal.details),
    examYear: readExamYear(goal.details),
    from: startedOn,
  });

  const isAhead = days.some((day) => day.date >= startedOn);
  const isPlanned = goalDate === null || days.some((day) => day.date === goalDate);
  // A class test read from the learner's own material has no past editions to estimate from.
  const isEstimatedClassTest = estimated && Boolean(blueprint?.ownerId);

  if (isAhead && isPlanned && !isEstimatedClassTest) {
    return {
      days: days.map((day) => ({ date: day.date, label: day.label, startTime: day.startTime })),
      estimated,
      timeZone: edition?.timeZone ?? null,
    };
  }

  // A date that's the start of the month the learner named is that guess: there's no notice day
  // yet, or the notice's is in another month and waits for their answer.
  const isNamedMonth =
    goalDate !== null &&
    goalDate === getNamedMonthStart({ details: goal.details, from: startedOn });

  return {
    days: goalDate ? [{ date: goalDate, label: null, startTime: null }] : [],
    estimated: isNamedMonth,
    timeZone: null,
  };
}

/**
 * Whether the date the plan counts down to is an estimate: the likely day of an edition whose
 * notice isn't out yet. Every screen that shows the date says so.
 */
export function isEstimatedGoalDate(input: Parameters<typeof getExamCalendar>[0]): boolean {
  const { goal } = input;

  if (!goal.targetDate) {
    return false;
  }

  const goalDate = toIsoDate(goal.targetDate);
  const calendar = getExamCalendar(input);

  return calendar.estimated && calendar.days.some((day) => day.date === goalDate);
}

/** The days as UTC-midnight labels, as learner-local dates are stored. */
export function toExamDates(calendar: ExamCalendar): Date[] {
  return calendar.days.map((day) => fromIsoDate(day.date));
}

/** The learner-local day the goal started, as a UTC-midnight label like the exam's days. */
function getGoalStartDate(goal: Pick<Goal, "createdAt" | "timezone">): Date {
  return getDateInTimeZone({ date: goal.createdAt, timeZone: getAnswerTimeZone({ goal }) });
}
