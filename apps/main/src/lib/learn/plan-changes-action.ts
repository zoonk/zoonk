"use server";

import { getPlanChangedSince } from "@zoonk/core/plans/changed-since";
import { type PlanWatch, planWatchSchema } from "@zoonk/core/plans/changed-since-contract";
import { z } from "zod";

const inputSchema = z.object({
  goalId: z.uuid(),
  since: z.number().int().nonnegative(),
  watch: planWatchSchema,
});

/** A tab that can't tell, or whose goal is gone, reads itself again. */
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
