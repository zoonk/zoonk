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

/**
 * Follows the learner to their device's zone when Today opens (the API's `GET /v1/today` does the
 * same with its `timeZone`). True when the learner's day moved, so Today reads itself again.
 */
export async function followTimeZoneAction(input: {
  goalId: string;
  timeZone: string;
}): Promise<boolean> {
  const parsed = followInputSchema.safeParse(input);

  if (!parsed.success) {
    return false;
  }

  const { data: result, error } = await safeAsync(() => followGoalTimeZone(parsed.data));

  if (error) {
    logError("[followTimeZoneAction] Failed to follow the learner's time zone:", error);
    return false;
  }

  return result.status === "ready" && result.moved;
}
