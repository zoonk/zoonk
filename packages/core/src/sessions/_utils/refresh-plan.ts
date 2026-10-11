import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { after } from "next/server";
import { loadAnswerPlanReadings } from "../../learner/_utils/load-skill-claims";
import { type PlanTagRevalidation } from "../../plans/_utils/replan";
import { refreshGoalPlan } from "../../plans/refresh-goal-plan";

/**
 * Keeps the goal's plan current around its sessions: before a day is built (what earlier days left
 * comes first, so today's lessons are the right ones; nothing else moves, see `settleOnly`), after
 * a placement answer in a session, and after a session ends, when the learner's progress sets the
 * pace. Building a day is a read that can run while the Today screen renders (or is prefetched),
 * where Next.js doesn't allow clearing caches, so it skips that (`skip`; see
 * `PlanTagRevalidation`). A failed refresh is logged and the session goes on with the plan as it
 * is, since the learner's day matters more.
 */
export async function refreshPlanAroundSession({
  goalId,
  pace,
  revalidation = "now",
  settleOnly = pace === "saved",
}: {
  goalId: string | null;
  /** `sampled` once a session ended (the learner's progress); `saved` otherwise. */
  pace: "sampled" | "saved";
  revalidation?: PlanTagRevalidation;
  /** Only settle what earlier days left: building a day, unless an answer told the plan more. */
  settleOnly?: boolean;
}): Promise<void> {
  if (!goalId) {
    return;
  }

  const { error } = await safeAsync(() =>
    refreshGoalPlan({ goalId, pace, revalidation, settleOnly }),
  );

  if (error) {
    logError(`Could not refresh the plan of goal ${goalId}.`, error);
  }
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
      await refreshPlanAroundSession({
        goalId,
        pace: "saved",
        revalidation: "skip",
        settleOnly: false,
      });
    }
  });
}
