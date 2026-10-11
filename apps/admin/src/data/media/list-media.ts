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

    // Counted for the page's assets only: a relation `_count` would count every asset's steps.
    const steps = await prisma.step.groupBy({
      _count: { id: true },
      by: ["mediaAssetId"],
      where: { mediaAssetId: { in: assets.map((asset) => asset.id) } },
    });

    const stepsByAsset = new Map(steps.map((row) => [row.mediaAssetId, row._count.id]));

    return {
      assets: assets.map((asset) => ({
        ...asset,
        _count: { steps: stepsByAsset.get(asset.id) ?? 0 },
      })),
      total,
    };
  },
);

export type ListedMediaAsset = Awaited<ReturnType<typeof listMedia>>["assets"][number];

/** Images and audio made once and reused by reuse key, with how many steps point at each. */
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
