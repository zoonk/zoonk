import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

const SOURCE_EXCERPT_LENGTH = 3000;

const cachedGetSource = cacheAdminData(async (sourceId: string) => {
  const [source, publicText] = await Promise.all([
    prisma.source.findUnique({
      include: {
        _count: {
          select: {
            changeNotices: true,
            examBlueprints: true,
            items: true,
            learnerSources: { where: trackedAnalyticsUserRelationWhere },
          },
        },
        owner: { select: { email: true, id: true, name: true } },
      },
      omit: { blobUrl: true, extractedText: true },
      where: { id: sourceId },
    }),
    prisma.source.findFirst({
      select: { extractedText: true },
      where: { id: sourceId, visibility: "public" },
    }),
  ]);

  if (!source) {
    return null;
  }

  if (source.visibility === "private") {
    return {
      _count: source._count,
      createdAt: source.createdAt,
      fetchedAt: source.fetchedAt,
      id: source.id,
      kind: source.kind,
      language: source.language,
      owner: source.owner,
      updatedAt: source.updatedAt,
      visibility: "private" as const,
    };
  }

  return {
    ...source,
    excerpt: publicText?.extractedText?.slice(0, SOURCE_EXCERPT_LENGTH) ?? null,
    textLength: publicText?.extractedText?.length ?? 0,
    visibility: "public" as const,
  };
});

type AdminSource = NonNullable<Awaited<ReturnType<typeof getSource>>>;
export type AdminPublicSource = Extract<AdminSource, { visibility: "public" }>;
export type AdminPrivateSource = Extract<AdminSource, { visibility: "private" }>;

/** A private upload is personal data: only its metadata leaves this function. */
export async function getSource(sourceId: string) {
  return cachedGetSource(sourceId);
}
