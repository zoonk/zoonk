import { getPlacementExamWait } from "@zoonk/core/library/exams/notice-formats";

export async function readPlacementExamWaitStep(goalId: string): Promise<"blueprint" | null> {
  "use step";

  return getPlacementExamWait(goalId);
}
