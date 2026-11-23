import "server-only";
import { type LearnerSourceOrigin, type TransactionClient, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";

type OwnSources = {
  /** The sources the sent ids name now, in the order sent, each once. */
  resolved: string[];
  /** The sent ids that name none of the learner's sources. */
  unresolved: string[];
};

function toCurrentIds(
  links: { source: { id: string; redirectedFrom: { fromId: string }[] } }[],
): Map<string, string> {
  return new Map(
    links.flatMap(({ source }) => [
      [source.id, source.id] as const,
      ...source.redirectedFrom.map((redirect) => [redirect.fromId, source.id] as const),
    ]),
  );
}

/**
 * Internal: `userId` must come from the session. An id names one of the learner's own sources, or
 * the shared copy their upload was merged into; another learner's merged upload names nothing.
 */
export async function findOwnSources({
  db = prisma,
  origin,
  sourceIds,
  userId,
}: {
  db?: TransactionClient;
  origin?: LearnerSourceOrigin;
  sourceIds: readonly string[];
  userId: string;
}): Promise<OwnSources> {
  const sent = [...new Set(sourceIds)];
  const ids = sent.filter((id) => isUuid(id));

  const links =
    ids.length === 0
      ? []
      : await db.learnerSource.findMany({
          select: {
            source: {
              select: {
                id: true,
                redirectedFrom: {
                  select: { fromId: true },
                  where: { fromId: { in: ids }, userId },
                },
              },
            },
          },
          where: {
            OR: [
              { sourceId: { in: ids } },
              { source: { redirectedFrom: { some: { fromId: { in: ids }, userId } } } },
            ],
            origin,
            userId,
          },
        });

  const current = toCurrentIds(links);

  return {
    resolved: [...new Set(sent.flatMap((id) => current.get(id) ?? []))],
    unresolved: sent.filter((id) => !current.has(id)),
  };
}

/**
 * Internal: the ids were authorized when a run was handed them. A merged upload reads as the shared
 * copy it became, so a run that started before the merge still finds it.
 */
export async function followSourceRedirects(sourceIds: readonly string[]): Promise<string[]> {
  const redirects =
    sourceIds.length === 0
      ? []
      : await prisma.sourceRedirect.findMany({
          select: { fromId: true, toId: true },
          where: { fromId: { in: [...sourceIds] } },
        });

  const moved = new Map(redirects.map((redirect) => [redirect.fromId, redirect.toId]));

  return [...new Set(sourceIds.map((id) => moved.get(id) ?? id))];
}
