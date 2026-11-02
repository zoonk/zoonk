import { type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type Allowance } from "../../entitlements/contract";
import { addDays } from "../../plans/planner/plan-calendar";

export type ExamPrepAccess = {
  includesMockExams: boolean;
  /** New lessons, practice, and mocks require Plus once the free exam days end. */
  trialEnded: boolean;
};

type AccessGoal = Pick<Goal, "createdAt" | "kind">;

/** Local-day boundary; null for non-exam goals or plans with unlimited study days. */
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

/** Reviews and fixing mistakes remain unlocked after free exam days end. */
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
