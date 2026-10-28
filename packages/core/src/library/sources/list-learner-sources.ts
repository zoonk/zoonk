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

  return prisma.learnerSource.findMany({
    include: { source: { omit: { extractedText: true } } },
    orderBy: { createdAt: "desc" },
    take: MAX_LEARNER_SOURCES,
    where: { userId: session.user.id, ...(goalId ? { goalId } : {}) },
  });
}
