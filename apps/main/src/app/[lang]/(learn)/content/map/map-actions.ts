"use server";

import { startGoalWork } from "@/lib/goals/start-goal-work";
import { type PracticeBlockResult, openPracticeBlock } from "@/lib/session/open-practice-block";
import { continueGoalAtNextLevel } from "@zoonk/core/goals/continue-next-level";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { addRefreshPracticeBlock } from "@zoonk/core/sessions/refresh-practice";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/**
 * "Refresh now" on the map: core adds practice on the fading skills to today's session, then it
 * starts where it's played. The same capability as `POST /v1/goals/{goalId}/refresh-practice`.
 */
export async function refreshFadingAction(
  goalId: string,
  input: { timeZone: string },
): Promise<PracticeBlockResult> {
  const parsed = studySessionTimeZoneInputSchema.safeParse(input);

  if (!parsed.success) {
    return { outcome: "failed" };
  }

  return openPracticeBlock({
    add: () => addRefreshPracticeBlock({ goalId, input: parsed.data }),
    label: "refreshFadingAction",
    timeZone: input.timeZone,
  });
}

/**
 * "Continue at Beginner": core completes the finished goal and creates the next level's goal in
 * its place, then its research and curriculum start on the API, as
 * `POST /v1/goals/{goalId}/next-level` does.
 */
export async function continueNextLevelAction(goalId: string): Promise<boolean> {
  const { data, error } = await safeAsync(() => continueGoalAtNextLevel(goalId));

  if (error) {
    logError("[continueNextLevelAction] Failed to continue at the next level:", error);
    return false;
  }

  if (data.status !== "created") {
    return false;
  }

  await startGoalWork([data.goal]);
  return true;
}
