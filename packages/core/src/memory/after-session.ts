import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { after } from "next/server";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";
import { findActiveGoalId } from "../goals/_utils/goal-view";
import { getMemoryAccess } from "./_utils/memory-access";
import { checkDailyInsight } from "./insights/_utils/check-insight";
import { hasEnoughActivity, loadGoalActivity } from "./insights/_utils/goal-activity";
import { updateMemoryFromActivity } from "./update-memory-from-activity";

type AfterSessionRequest = {
  /** The session's goal; the learner's active goal is checked for a session without one. */
  goalId: string | null;
  /** The study session that just ended, kept as the source of facts noticed from it. */
  sessionId: string | null;
  timeZone: string;
  userId: string;
};

/**
 * What memory does after each study session: it notices lasting patterns in the week's answers
 * (such as "Mixes up fractions and percentages" or "Studies after 8 pm") and runs the daily insight
 * check, which proposes at most one tip, plan change or schedule idea a day. Both read the same
 * measured week, both are skipped while memory is off, and neither runs a model on too little
 * activity.
 */
async function runMemoryAfterSession(request: AfterSessionRequest): Promise<void> {
  const { sessionId, timeZone, userId } = request;
  const access = await getMemoryAccess(userId);

  if (!access.enabled) {
    return;
  }

  const goalId = request.goalId ?? (await findActiveGoalId(userId));

  const activity = goalId
    ? await loadGoalActivity({ goalId, now: new Date(), timeZone, userId })
    : null;

  if (!activity) {
    return;
  }

  if (hasEnoughActivity(activity.signals)) {
    await updateMemoryFromActivity({
      goalId: activity.goal.id,
      source: {
        activity: activity.signals.text,
        id: sessionId,
        kind: "session",
        language: activity.goal.language,
      },
      timeZone: activity.timeZone,
      userId,
    });
  }

  const insight = await checkDailyInsight({ activity, userId });

  if (insight.status === "checked") {
    revalidateCacheTags([getMemoryCacheTag(userId)]);
  }
}

/**
 * Runs `runMemoryAfterSession` after the response of the request that ended a study session;
 * nobody waits for it. A failure is logged, and the next session tries again.
 *
 * This is a bridge for the session flow: `userId` comes from the capability that finished the
 * session for the signed-in learner.
 */
export function scheduleMemoryAfterSession(request: AfterSessionRequest): void {
  after(async () => {
    const { error } = await safeAsync(() => runMemoryAfterSession(request));

    if (error) {
      logError(`Could not run memory after a session for learner ${request.userId}.`, error);
    }
  });
}
