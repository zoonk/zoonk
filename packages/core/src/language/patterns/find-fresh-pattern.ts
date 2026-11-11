import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

const FRESH_DAYS = 7;

/**
 * A pattern belongs to the goal that noticed it, so one drill completes one goal's mission; once
 * that goal is paused, finished or removed, another goal of its language may offer it.
 */
export function offeredToGoal(goalId: string) {
  return { OR: [{ goalId }, { goalId: null }, { goal: { status: { not: "active" as const } } }] };
}

export function findFreshMistakePattern({
  goalId,
  language,
  mistakeIds,
  userId,
}: {
  goalId?: string;
  language: string;
  mistakeIds?: readonly string[];
  userId: string;
}) {
  return prisma.mistakePattern.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, kind: true, title: true },
    where: {
      createdAt: { gte: new Date(Date.now() - FRESH_DAYS * MS_PER_DAY) },
      dismissedAt: null,
      ...(goalId ? offeredToGoal(goalId) : {}),
      language,
      practicedAt: null,
      userId,
      ...(mistakeIds ? { mistakeIds: { hasSome: [...mistakeIds] } } : {}),
    },
  });
}
