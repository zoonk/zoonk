import "server-only";
import { prisma } from "@zoonk/db";
import { findActiveSubscription } from "../auth/subscription";
import { type EntitlementTier } from "../entitlements/contract";

/**
 * How much is written before a learner gets there. Content is written once and shared, but what
 * nobody reaches is paid for anyway, so Plus subscribers get more written ahead than free learners,
 * and guests (who may never come back) the least. A learner never waits on a lesson because of
 * it: today's next lessons are always written while the current one is studied.
 */
export type LearnerLookahead = {
  /** Unwritten lessons of today's session written after the one the learner is in. */
  lessonsAhead: number;
  /** First lessons of the next study day, written in the background at the flex tier. */
  nextDayLessons: number;
  /**
   * Days of the plan whose courses get their level bands outlined when the plan is built; later
   * bands are outlined as the plan gets close to them. Null outlines every band the plan needs.
   */
  outlineDays: number | null;
  /** First lessons of the likeliest starting phases written while placement runs. */
  speculativeLessons: number;
};

const LOOKAHEAD: Record<EntitlementTier, LearnerLookahead> = {
  free: { lessonsAhead: 2, nextDayLessons: 1, outlineDays: 14, speculativeLessons: 2 },
  guest: { lessonsAhead: 1, nextDayLessons: 0, outlineDays: 7, speculativeLessons: 0 },
  plus: { lessonsAhead: 4, nextDayLessons: 3, outlineDays: null, speculativeLessons: 4 },
};

export function getLookahead(tier: EntitlementTier): LearnerLookahead {
  return LOOKAHEAD[tier];
}

/**
 * The learner's plan for sizing what's written ahead: a guest, a free learner or a Plus subscriber.
 *
 * This is a workflow bridge: the user is the owner of the goal the workflow works for.
 */
export async function getLearnerTier(userId: string): Promise<EntitlementTier> {
  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({ select: { isAnonymous: true }, where: { id: userId } }),
    findActiveSubscription(userId),
  ]);

  if (!user || user.isAnonymous) {
    return "guest";
  }

  return subscription ? "plus" : "free";
}

/**
 * How far ahead content is written for the learner of a goal.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function getGoalLookahead(goalId: string): Promise<LearnerLookahead> {
  const goal = await prisma.goal.findUnique({ select: { userId: true }, where: { id: goalId } });
  return getLookahead(goal ? await getLearnerTier(goal.userId) : "guest");
}
