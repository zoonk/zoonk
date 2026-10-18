"use server";

import { getLearnerRevision } from "@zoonk/core/learner/revision";
import { getPlanChangedSince } from "@zoonk/core/plans/changed-since";
import { type PlanWatch, planWatchSchema } from "@zoonk/core/plans/changed-since-contract";
import { z } from "zod";

const inputSchema = z.object({
  goalId: z.uuid(),
  revision: z.string().regex(/^\d+$/u).nullable().optional(),
  since: z.number().int().nonnegative(),
  watch: planWatchSchema,
});

/**
 * Whether what the page watches (`watch`: the goal's plan, or today's session too) or their
 * lessons changed since the page read them (`since`, its read time), for a tab waiting on lessons
 * (`useRefreshOnPlanChange`) or showing an old copy (`useRefreshWhenOld`). A page that sends the
 * learner revision it read (`revision`) also hears of any other change the learner made since,
 * here or on another device (another goal chosen, the buddy renamed). A tab that can't tell, or
 * whose goal is gone, reads itself again.
 */
export async function hasPlanChangedAction(input: {
  goalId: string;
  revision?: string | null;
  since: number;
  watch: PlanWatch;
}): Promise<boolean> {
  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) {
    return true;
  }

  const { revision, ...query } = parsed.data;

  const [result, learner] = await Promise.all([
    getPlanChangedSince(query),
    revision === undefined ? null : getLearnerRevision(),
  ]);

  if (revision !== undefined && (learner?.revision ?? null) !== revision) {
    return true;
  }

  return result.status !== "ready" || result.changed;
}
