import { getPlacementExamWait } from "@zoonk/core/library/exams/notice-formats";

export async function readPlacementExamWaitStep(
  goalId: string,
): Promise<"blueprint" | "formats" | null> {
  "use step";

  return getPlacementExamWait(goalId);
}
