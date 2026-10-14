import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getLearningProfileCacheTag,
  getUserSubscriptionCacheTag,
} from "../cache/tags";
import {
  arePhaseChallengesRequired,
  withoutLockedPhaseChallenges,
} from "../checkpoints/_utils/phase-challenge-access";
import { findActiveGoalId } from "../goals/_utils/goal-view";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getSession } from "../users/get-session";
import { findCarriedOverSession } from "./_utils/current-session";
import { getNextBlockId, getSessionBar } from "./_utils/session-view";
import { STUDY_SESSION_INCLUDE } from "./_utils/study-session-access";
import { readBlockPayload } from "./block-payload";

export type SavedTodayQueue = {
  blocksLeft: number;
  next: { minutes: number; sessionId: string; title: string | null } | null;
};

/**
 * The authenticated learner's already-saved day for navigation displays. Missing days stay
 * missing: this read never creates a session, refreshes its blocks, or settles the plan. A
 * session carried past midnight follows the same selection rule as Today.
 */
export async function getSavedTodayQueue(): Promise<SavedTodayQueue | null> {
  "use cache: private";

  const viewer = await getSession();

  if (!viewer) {
    return null;
  }

  const userId = viewer.user.id;

  cacheTag(
    getGoalsCacheTag(userId),
    getLearningProfileCacheTag(userId),
    getUserSubscriptionCacheTag(userId),
    getLearnerModelCacheTag(userId),
  );

  const goalId = await findActiveGoalId(userId);

  if (!goalId) {
    return null;
  }

  const goal = await prisma.goal.findFirst({
    where: { id: goalId, kind: { not: "explain" }, status: "active", userId },
  });

  if (!goal) {
    return null;
  }

  const timeZone = getAnswerTimeZone({ goal });
  const now = new Date();
  const localDate = getDateInTimeZone({ date: now, timeZone });

  const [today, carried] = await Promise.all([
    prisma.studySession.findUnique({
      include: STUDY_SESSION_INCLUDE,
      where: { userGoalDate: { goalId, localDate, userId } },
    }),
    findCarriedOverSession({ goalId, now, timeZone, userId }),
  ]);

  const day = carried && !today?.startedAt ? carried : today;

  if (!day) {
    return null;
  }

  const blocks = withoutLockedPhaseChallenges({
    blocks: day.blocks,
    phaseChallengesRequired: await arePhaseChallengesRequired({ goalKind: goal.kind, userId }),
  });

  const bar = getSessionBar(blocks);
  const nextId = getNextBlockId(blocks);
  const next = blocks.find((block) => block.id === nextId);
  const payload = next ? readBlockPayload(next) : null;

  return {
    blocksLeft: bar.total - bar.completed,
    next: next
      ? {
          minutes: next.estimatedMinutes ?? 0,
          sessionId: day.id,
          title: payload?.title ?? payload?.capsules[0]?.title ?? null,
        }
      : null,
  };
}
