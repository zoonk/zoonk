import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../../users/get-session";

const MAX_LEARNER_SOURCES = 50;

export async function listLearnerSources({ goalId }: { goalId?: string | null } = {}) {
  const session = await getSession();

  if (!session) {
    return null;
  }

  if (goalId && !isUuid(goalId)) {
    return [];
  }

  const userId = session.user.id;
  const ownGoals = { goal: { userId } };

  const links = await prisma.learnerSource.findMany({
    include: {
      source: {
        include: { goalSources: { orderBy: { createdAt: "asc" }, where: ownGoals } },
        omit: { extractedText: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_LEARNER_SOURCES,
    where: {
      userId,
      ...(goalId ? { source: { goalSources: { some: { ...ownGoals, goalId } } } } : {}),
    },
  });

  return links.map(({ source: { goalSources, ...source }, ...link }) => ({
    ...link,
    goalIds: goalSources.map((goalSource) => goalSource.goalId),
    source,
  }));
}
