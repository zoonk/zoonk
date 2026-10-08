import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { type LibraryVisibility, type SourceKind, prisma } from "@zoonk/db";
import { redactSourceTitle } from "./_utils/source-title";

/**
 * Search matches public titles only: a private upload's title can be personal
 * data, so it is never searchable.
 */
function buildSourceWhere({
  kind,
  search,
  visibility,
}: {
  kind?: SourceKind;
  search?: string;
  visibility?: LibraryVisibility;
}) {
  const searchWhere = search
    ? { title: { contains: search, mode: "insensitive" as const }, visibility: "public" as const }
    : {};

  return { AND: [{ kind, visibility }, searchWhere] };
}

const cachedListSources = cacheAdminData(
  async (
    limit: number,
    offset: number,
    kind?: SourceKind,
    visibility?: LibraryVisibility,
    search?: string,
  ) => {
    const where = buildSourceWhere({ kind, search, visibility });

    const [sources, total] = await Promise.all([
      prisma.source.findMany({
        include: {
          _count: {
            select: {
              examBlueprints: true,
              learnerSources: { where: trackedAnalyticsUserRelationWhere },
            },
          },
        },
        omit: { blobUrl: true, extractedText: true, reusePolicy: true, structure: true },
        orderBy: [{ fetchedAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
        where,
      }),
      prisma.source.count({ where }),
    ]);

    return { sources: sources.map((source) => redactSourceTitle(source)), total };
  },
);

export type ListedSource = Awaited<ReturnType<typeof listSources>>["sources"][number];

/**
 * Sources are the documents exams and items are read from. Private uploads
 * are listed by their metadata only; their title is dropped before it leaves
 * this function.
 */
export async function listSources({
  kind,
  limit,
  offset,
  search,
  visibility,
}: {
  kind?: SourceKind;
  limit: number;
  offset: number;
  search?: string;
  visibility?: LibraryVisibility;
}) {
  return cachedListSources(limit, offset, kind, visibility, search);
}
