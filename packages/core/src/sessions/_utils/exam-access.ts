import { type Goal } from "@zoonk/db";
import { type Allowance } from "../../entitlements/contract";

export type ExamPrepAccess = { includesMockExams: boolean };

export function getExamPrepAccess({
  examPrep,
  goal,
}: {
  examPrep: Allowance["examPrep"] | null;
  goal: Pick<Goal, "kind">;
}): ExamPrepAccess {
  return { includesMockExams: goal.kind !== "exam" || !examPrep || examPrep.includesMockExams };
}
