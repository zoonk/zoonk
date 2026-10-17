import { type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type Allowance } from "../../entitlements/contract";
import { addDays } from "../../plans/planner/plan-calendar";

export type ExamPrepAccess = {
  /** Mock exams (an exam goal's weekly Big Challenge) are part of the learner's plan. */
  includesMockExams: boolean;
  /** A free exam plan past its first days: new lessons, practice and mocks offer Plus instead. */
  trialEnded: boolean;
};

type AccessGoal = Pick<Goal, "createdAt" | "kind">;

/**
 * The last day a free exam plan covers: its first `studyDays`, counted from the day the goal
 * started in the learner's time zone. Null when the plan covers all of it, or for a goal that isn't
 * an exam.
 */
export function getFreeWeekEnd({
  examPrep,
  goal,
  timeZone,
}: {
  examPrep: Allowance["examPrep"] | null;
  goal: AccessGoal;
  timeZone: string;
}): Date | null {
  if (goal.kind !== "exam" || !examPrep || examPrep.studyDays === null) {
    return null;
  }

  const startedOn = getDateInTimeZone({ date: goal.createdAt, timeZone });
  return addDays(startedOn, examPrep.studyDays - 1);
}

/**
 * What exam prep the learner's plan covers today. The free plan covers the diagnostic, the plan
 * and its first days, without mock exams; reviews and fixing mistakes are never locked. Goals
 * that aren't exams are unaffected.
 */
export function getExamPrepAccess({
  examPrep,
  goal,
  timeZone,
  today,
}: {
  examPrep: Allowance["examPrep"] | null;
  goal: AccessGoal;
  timeZone: string;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
}): ExamPrepAccess {
  if (goal.kind !== "exam" || !examPrep) {
    return { includesMockExams: true, trialEnded: false };
  }

  const freeUntil = getFreeWeekEnd({ examPrep, goal, timeZone });

  return {
    includesMockExams: examPrep.includesMockExams,
    trialEnded: freeUntil !== null && today.getTime() > freeUntil.getTime(),
  };
}
