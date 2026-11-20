import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type LibraryVisibility, type MediaKind, prisma } from "@zoonk/db";

const cachedListMedia = cacheAdminData(
  async (limit: number, offset: number, kind?: MediaKind, visibility?: LibraryVisibility) => {
    const where = { kind, visibility };

    const [assets, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        omit: { prompt: true, scene: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
        where,
      }),
      prisma.mediaAsset.count({ where }),
    ]);

    const assetIds = assets.map((asset) => asset.id);

    // For the page's assets only: a relation `_count` would count every asset's screens.
    const [counts, firstUses] = await Promise.all([
      prisma.step.groupBy({
        _count: { id: true },
        by: ["mediaAssetId"],
        where: { mediaAssetId: { in: assetIds } },
      }),
      prisma.step.findMany({
        distinct: ["mediaAssetId"],
        orderBy: [{ mediaAssetId: "asc" }, { lessonId: "asc" }, { position: "asc" }],
        select: { lesson: { select: { title: true } }, mediaAssetId: true },
        where: { mediaAssetId: { in: assetIds } },
      }),
    ]);

    const screensByAsset = new Map(counts.map((row) => [row.mediaAssetId, row._count.id]));
    const lessonByAsset = new Map(firstUses.map((row) => [row.mediaAssetId, row.lesson.title]));

    return {
      assets: assets.map((asset) => ({
        ...asset,
        _count: { steps: screensByAsset.get(asset.id) ?? 0 },
        usedIn: lessonByAsset.get(asset.id) ?? null,
      })),
      total,
    };
  },
);

export type ListedMediaAsset = Awaited<ReturnType<typeof listMedia>>["assets"][number];

export async function listMedia({
  kind,
  limit,
  offset,
  visibility,
}: {
  kind?: MediaKind;
  limit: number;
  offset: number;
  visibility?: LibraryVisibility;
}) {
  return cachedListMedia(limit, offset, kind, visibility);
}
