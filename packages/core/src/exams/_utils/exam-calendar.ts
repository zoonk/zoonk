import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { fromIsoDate, toIsoDate } from "../../plans/planner/plan-calendar";
import { type ExamDay } from "../view/exam-view-contract";
import {
  getExamEditionDays,
  getNamedMonthStart,
  readExamMonth,
  readExamYear,
} from "./exam-edition-days";
import { findLearnerSitting, moveSittingToDate } from "./exam-sittings";

/**
 * The exam's days, from its notice, or the goal's own date when the notice has none. `estimated`
 * days are the ones the edition most likely has, until its notice is stored. `namedMonth`: the one
 * day is the start of the month the learner named ("in March"), which stands for that month, so
 * screens say the month instead of a day.
 */
type ExamCalendar = {
  days: ExamDay[];
  estimated: boolean;
  namedMonth: boolean;
  timeZone: string | null;
};

/**
 * When the learner's exam is: every exam day of the edition they prepare for with its start time
 * (of their sitting, when it's held several times a year), or the date the plan counts down to
 * when the notice doesn't give it, so every screen shows the plan's one date. The edition is the
 * year the learner named (ENEM 2028), or the notice's own while its days are ahead of the goal's
 * start; without a notice for it, its days are estimated from the notice's timing, as the next
 * edition's are once a notice's days all passed before the goal started. A goal date that isn't
 * one of those days is the learner's own (a school test on Friday, a sitting the notice doesn't
 * list), or one they kept when the notice gave another; estimated days near it move to it, since
 * the learner knows their day better than past editions' timing.
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

  // An exam held several times a year is the learner's sitting only (see `findLearnerSitting`).
  const found = findLearnerSitting({ days, from: startedOn, goalDate }) ?? [];
  const isOnFound = goalDate === null || found.some((day) => day.date === goalDate);

  // Estimated days follow the learner's date near them (`moveSittingToDate`).
  const sitting =
    estimated && !isOnFound && goalDate
      ? (moveSittingToDate({ date: goalDate, sitting: found }) ?? found)
      : found;

  const isPlanned = goalDate === null || sitting.some((day) => day.date === goalDate);
  // A class test read from the learner's own material has no past editions to estimate from.
  const isEstimatedClassTest = estimated && Boolean(blueprint?.ownerId);

  if (sitting.length > 0 && isPlanned && !isEstimatedClassTest) {
    return {
      days: sitting.map((day) => ({ date: day.date, label: day.label, startTime: day.startTime })),
      estimated,
      namedMonth: false,
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
    namedMonth: isNamedMonth,
    timeZone: null,
  };
}

/**
 * How the date the plan counts down to is known: `estimated`, the likely day of an edition whose
 * notice isn't out yet, or the start of the month the learner named; `namedMonth`, that start of
 * the month, which stands for the month, so screens say the month ("December 2026") instead of a
 * day in it. Every screen that shows the date says so.
 */
export type GoalDateKind = { estimated: boolean; namedMonth: boolean };

export function getGoalDateKind(input: Parameters<typeof getExamCalendar>[0]): GoalDateKind {
  const { goal } = input;

  if (!goal.targetDate) {
    return { estimated: false, namedMonth: false };
  }

  const goalDate = toIsoDate(goal.targetDate);
  const calendar = getExamCalendar(input);
  const isPlanned = calendar.days.some((day) => day.date === goalDate);

  return {
    estimated: calendar.estimated && isPlanned,
    namedMonth: calendar.namedMonth && isPlanned,
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
