import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

/** A noticed pattern is offered for a week: an older one says little about today's mistakes. */
const FRESH_DAYS = 7;

/**
 * The newest pattern noticed in the learner's recent mistakes in one language that they haven't
 * practiced or dismissed yet, within a week. With `mistakeIds`, only a pattern shown by one of
 * those mistakes (a unit's), so a unit offers only its own.
 */
export function findFreshMistakePattern({
  language,
  mistakeIds,
  userId,
}: {
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
      language,
      practicedAt: null,
      userId,
      ...(mistakeIds ? { mistakeIds: { hasSome: [...mistakeIds] } } : {}),
    },
  });
}
