"use server";

import { followGoalTimeZone } from "@zoonk/core/learner/follow-time-zone";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { z } from "zod";

const followInputSchema = z.object({
  goalId: z.uuid(),
  timeZone: z.string().refine(isValidTimeZone),
});

export async function followTimeZoneAction(input: { goalId: string; timeZone: string }) {
  const parsed = followInputSchema.safeParse(input);

  if (!parsed.success) {
    return;
  }

  const { error } = await safeAsync(() => followGoalTimeZone(parsed.data));

  if (error) {
    logError("[followTimeZoneAction] Failed to follow the learner's time zone:", error);
  }
}
