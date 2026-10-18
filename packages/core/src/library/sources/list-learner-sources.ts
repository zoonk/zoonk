import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../../users/get-session";

const MAX_LEARNER_SOURCES = 50;

/**
 * The learner's own material: what they uploaded or pasted and what research
 * found for their goals, newest first. Public uploads they shared stay here
 * after deduplication because the link is theirs. Null means signed out.
 */
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
