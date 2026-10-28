import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { after } from "next/server";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";
import { findActiveGoalId } from "../goals/_utils/goal-view";
import { isMemoryEnabled } from "./_utils/memory-access";
import { checkDailyInsight } from "./insights/_utils/check-insight";
import { hasEnoughActivity, loadGoalActivity } from "./insights/_utils/goal-activity";
import { updateMemoryFromActivity } from "./update-memory-from-activity";

type AfterSessionRequest = {
  goalId: string | null;
  sessionId: string | null;
  timeZone: string;
  userId: string;
};

async function runMemoryAfterSession(request: AfterSessionRequest): Promise<void> {
  const { sessionId, timeZone, userId } = request;

  if (!(await isMemoryEnabled(userId))) {
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
 * Never throws: it runs after the response and logs a failure. `userId` must come from the
 * capability that finished the session for the signed-in learner.
 */
export function scheduleMemoryAfterSession(request: AfterSessionRequest): void {
  after(async () => {
    const { error } = await safeAsync(() => runMemoryAfterSession(request));

    if (error) {
      logError(`Could not run memory after a session for learner ${request.userId}.`, error);
    }
  });
}
