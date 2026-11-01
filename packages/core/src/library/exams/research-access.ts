import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../../users/get-session";

const MAX_RESEARCH_SOURCES = 5;

export type ResearchAccess =
  | { status: "unauthorized" }
  | { status: "notFound" }
  | { goalId: string; researchRunId: string | null; sourceIds: string[]; status: "ready" };

/** Only the learner's own uploads, so a pick from the Library can't steer a shared blueprint. */
async function findOwnUploadIds({
  sourceIds,
  userId,
}: {
  sourceIds: string[];
  userId: string;
}): Promise<string[] | null> {
  const ids = [...new Set(sourceIds)].slice(0, MAX_RESEARCH_SOURCES);

  if (ids.some((id) => !isUuid(id))) {
    return null;
  }

  const uploads = await prisma.learnerSource.count({
    where: { origin: "upload", sourceId: { in: ids }, userId },
  });

  return uploads === ids.length ? ids : null;
}

export async function getResearchAccess({
  goalId,
  sourceIds = [],
}: {
  goalId: string;
  sourceIds?: string[];
}): Promise<ResearchAccess> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(goalId)) {
    return { status: "notFound" };
  }

  const [goal, readableIds] = await Promise.all([
    prisma.goal.findFirst({
      select: { id: true, researchRunId: true },
      where: { id: goalId, userId: session.user.id },
    }),
    findOwnUploadIds({ sourceIds, userId: session.user.id }),
  ]);

  if (!goal || !readableIds) {
    return { status: "notFound" };
  }

  return {
    goalId: goal.id,
    researchRunId: goal.researchRunId,
    sourceIds: readableIds,
    status: "ready",
  };
}
