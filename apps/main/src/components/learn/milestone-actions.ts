"use server";

import { markMilestoneShown } from "@zoonk/core/milestones/list";

export async function markMilestoneShownAction(milestoneId: string): Promise<void> {
  await markMilestoneShown(milestoneId);
}
