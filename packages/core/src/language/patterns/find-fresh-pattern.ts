import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

const FRESH_DAYS = 7;

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
