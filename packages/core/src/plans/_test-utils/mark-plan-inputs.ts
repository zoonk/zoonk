import { prisma } from "@zoonk/db";
import { markPlansChanged } from "../../learner/_utils/mark-learner-changed";

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
