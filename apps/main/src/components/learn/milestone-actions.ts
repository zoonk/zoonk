"use server";

import { markMilestoneShown } from "@zoonk/core/milestones/list";

/** A milestone is celebrated once: core ignores ids that aren't the learner's own. */
export async function markMilestoneShownAction(milestoneId: string): Promise<void> {
  await markMilestoneShown(milestoneId);
}
