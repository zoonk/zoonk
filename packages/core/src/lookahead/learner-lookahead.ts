import "server-only";
import { prisma } from "@zoonk/db";
import { findActiveSubscription } from "../auth/subscription";
import { type EntitlementTier } from "../entitlements/contract";
import { OUTLINE_AHEAD_DAYS } from "./outline-ahead";

export type LearnerLookahead = {
  /** Unwritten lessons of today's session written after the one the learner is in. */
  lessonsAhead: number;
  /** First lessons of the next study day, written in the background at the flex tier. */
  nextDayLessons: number;
  /** Limit upfront outlines because abandoned or changed plans may never use later bands. */
  outlineDays: number;
  /** First lessons of the likeliest starting phases written while placement runs. */
  speculativeLessons: number;
};

const LOOKAHEAD: Record<EntitlementTier, LearnerLookahead> = {
  free: {
    lessonsAhead: 2,
    nextDayLessons: 1,
    outlineDays: OUTLINE_AHEAD_DAYS,
    speculativeLessons: 2,
  },
  guest: { lessonsAhead: 1, nextDayLessons: 0, outlineDays: 7, speculativeLessons: 1 },
  plus: {
    lessonsAhead: 4,
    nextDayLessons: 3,
    outlineDays: OUTLINE_AHEAD_DAYS,
    speculativeLessons: 4,
  },
};

export function getLookahead(tier: EntitlementTier): LearnerLookahead {
  return LOOKAHEAD[tier];
}

/** Workflow bridge: userId must be the owner of the workflow's authorized goal. */
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

/** Workflow bridge: goalId must come from the authenticated public boundary. */
export async function getGoalLookahead(goalId: string): Promise<LearnerLookahead> {
  const goal = await prisma.goal.findUnique({ select: { userId: true }, where: { id: goalId } });
  return getLookahead(goal ? await getLearnerTier(goal.userId) : "guest");
}
