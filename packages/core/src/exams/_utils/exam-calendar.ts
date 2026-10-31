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

type ExamCalendar = {
  days: ExamDay[];
  estimated: boolean;
  namedMonth: boolean;
  timeZone: string | null;
};

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

  const found = findLearnerSitting({ days, from: startedOn, goalDate }) ?? [];
  const isOnFound = goalDate === null || found.some((day) => day.date === goalDate);

  const sitting =
    estimated && !isOnFound && goalDate
      ? (moveSittingToDate({ date: goalDate, sitting: found }) ?? found)
      : found;

  const isPlanned = goalDate === null || sitting.some((day) => day.date === goalDate);
  const isEstimatedClassTest = estimated && Boolean(blueprint?.ownerId);

  if (sitting.length > 0 && isPlanned && !isEstimatedClassTest) {
    return {
      days: sitting.map((day) => ({ date: day.date, label: day.label, startTime: day.startTime })),
      estimated,
      namedMonth: false,
      timeZone: edition?.timeZone ?? null,
    };
  }

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

/** `namedMonth` represents a whole month; display the month instead of its first day. */
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

function getGoalStartDate(goal: Pick<Goal, "createdAt" | "timezone">): Date {
  return getDateInTimeZone({ date: goal.createdAt, timeZone: getAnswerTimeZone({ goal }) });
}
