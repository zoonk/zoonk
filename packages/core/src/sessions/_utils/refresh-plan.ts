import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { after } from "next/server";
import { loadAnswerPlanReadings } from "../../learner/_utils/load-skill-claims";
import { refreshGoalPlan } from "../../plans/refresh-goal-plan";

/** Logs refresh failures and returns false so planning cannot interrupt session completion. */
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

/** Schedule after responding; placement changes must refresh short plans even when they skip no lessons. */
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
