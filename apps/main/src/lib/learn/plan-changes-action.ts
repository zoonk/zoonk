"use server";

import { getPlanChangedSince } from "@zoonk/core/plans/changed-since";
import { type PlanWatch, planWatchSchema } from "@zoonk/core/plans/changed-since-contract";
import { z } from "zod";

const inputSchema = z.object({
  goalId: z.uuid(),
  since: z.number().int().nonnegative(),
  watch: planWatchSchema,
});

/**
 * Whether what the page watches (`watch`: the goal's plan, or today's session too) or their
 * lessons changed since the page read them (`since`, its read time), for a tab waiting on lessons
 * (`useRefreshOnPlanChange`). A tab that can't tell, or whose goal is gone, reads itself again.
 */
export async function hasPlanChangedAction(input: {
  goalId: string;
  since: number;
  watch: PlanWatch;
}): Promise<boolean> {
  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) {
    return true;
  }

  const result = await getPlanChangedSince(parsed.data);
  return result.status !== "ready" || result.changed;
}
