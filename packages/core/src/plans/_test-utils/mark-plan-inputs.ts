import { prisma } from "@zoonk/db";
import { markPlansChanged } from "../../learner/_utils/mark-learner-changed";

/**
 * Marks the plan's inputs changed again and again until `signal` aborts, as other runs saving
 * lessons and questions for its skills do (`createLibraryLesson`, `createItems`), each in a
 * transaction of its own. Returns how many marks it made.
 */
export async function markPlanInputsUntil({
  planId,
  signal,
}: {
  planId: string;
  signal: AbortSignal;
}): Promise<number> {
  if (signal.aborted) {
    return 0;
  }

  await prisma.$transaction((tx) => markPlansChanged(tx, { planIds: [planId] }));
  return 1 + (await markPlanInputsUntil({ planId, signal }));
}
