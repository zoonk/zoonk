import { hasGoalExamFormat } from "@zoonk/core/library/exams/notice-formats";

/** Whether the goal knows how its exam asks questions yet (see `hasGoalExamFormat`). */
export async function hasGoalExamFormatStep(goalId: string): Promise<boolean> {
  "use step";

  return hasGoalExamFormat(goalId);
}
