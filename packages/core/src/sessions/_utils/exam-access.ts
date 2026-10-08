import { type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type Allowance } from "../../entitlements/contract";
import { daysBetween } from "../../plans/planner/plan-calendar";

export type ExamPrepAccess = {
  /** Mock exams (an exam goal's weekly Big Challenge) are part of the learner's plan. */
  includesMockExams: boolean;
  /** A free exam plan past its first days: new lessons, practice and mocks offer Plus instead. */
  trialEnded: boolean;
};

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
  goal: Pick<Goal, "createdAt" | "kind">;
  timeZone: string;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
}): ExamPrepAccess {
  if (goal.kind !== "exam" || !examPrep) {
    return { includesMockExams: true, trialEnded: false };
  }

  const startedOn = getDateInTimeZone({ date: goal.createdAt, timeZone });
  const studyDay = daysBetween(startedOn, today);

  return {
    includesMockExams: examPrep.includesMockExams,
    trialEnded: examPrep.studyDays !== null && studyDay >= examPrep.studyDays,
  };
}
