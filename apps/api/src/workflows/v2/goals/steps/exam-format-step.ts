import { getPlacementExamWait } from "@zoonk/core/library/exams/notice-formats";

/** What placement's first questions still wait for of the goal's exam (see `getPlacementExamWait`). */
export async function readPlacementExamWaitStep(
  goalId: string,
): Promise<"blueprint" | "formats" | null> {
  "use step";

  return getPlacementExamWait(goalId);
}
