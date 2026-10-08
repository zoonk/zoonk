import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type PlanTagRevalidation } from "../../plans/_utils/replan";
import { refreshGoalPlan } from "../../plans/refresh-goal-plan";

/**
 * Keeps the goal's plan current around its sessions: before a day is built (what earlier days left
 * comes first, so today's lessons are the right ones) and after a session ends, when the learner's
 * progress sets the pace. Building a day is a read
 * that can run while the Today screen renders (or is prefetched), where Next.js doesn't allow
 * clearing caches, so it skips that (`skip`; see `PlanTagRevalidation`). A failed refresh is logged
 * and the session goes on with the plan as it is, since the learner's day matters more.
 */
export async function refreshPlanAroundSession({
  goalId,
  pace,
  revalidation = "now",
}: {
  goalId: string | null;
  /** `sampled` once a session ended (the learner's progress); `saved` when a day is built. */
  pace: "sampled" | "saved";
  revalidation?: PlanTagRevalidation;
}): Promise<void> {
  if (!goalId) {
    return;
  }

  const { error } = await safeAsync(() => refreshGoalPlan({ goalId, pace, revalidation }));

  if (error) {
    logError(`Could not refresh the plan of goal ${goalId}.`, error);
  }
}
