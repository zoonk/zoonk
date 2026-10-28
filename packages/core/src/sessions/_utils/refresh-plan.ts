import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { after } from "next/server";
import { loadAnswerPlanReadings } from "../../learner/_utils/load-skill-claims";
import { refreshGoalPlan } from "../../plans/refresh-goal-plan";

/** Await the saved refresh, logging failures so planning cannot interrupt a session finish. */
export async function refreshPlanAroundSession({
  goalId,
  pace,
}: {
  goalId: string | null;
  /** `sampled` once a session ended (the learner's progress); `saved` otherwise. */
  pace: "sampled" | "saved";
}): Promise<boolean> {
  if (!goalId) {
    return false;
  }

  const { data, error } = await safeAsync(() =>
    refreshGoalPlan({ goalId, pace, revalidation: "skip" }),
  );

  if (error) {
    logError(`Could not refresh the plan of goal ${goalId}.`, error);
    return false;
  }

  return data.status === "refreshed" || data.status === "unchanged";
}

/**
 * Plans again after a placement answer in a session that skipped nothing, once the learner has the
 * response, when it changed what a plan reads of its skill (see `loadAnswerPlanReadings`): known,
 * a gap, missed. A plan short on time cuts by it, so the plan follows it now, as it would after the
 * session, or it says every topic fits while the plan the learner studies still leaves topics out
 * (a Câmara plan left 36). An answer that changes none of it leaves the plan as it is.
 */
export function refreshAfterPlacementAnswer({
  answeredAt,
  goalId,
  skillId,
  userId,
}: {
  answeredAt: Date;
  goalId: string;
  skillId: string;
  userId: string;
}): void {
  after(async () => {
    const { after: now, before } = await loadAnswerPlanReadings({
      answeredAt,
      goalId,
      skillId,
      userId,
    });

    // Past the response, no revalidation reaches the learner's browser (see `PlanTagRevalidation`).
    if (now !== before) {
      await refreshPlanAroundSession({ goalId, pace: "saved" });
    }
  });
}
