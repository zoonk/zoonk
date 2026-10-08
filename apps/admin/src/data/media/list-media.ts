import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type LibraryVisibility, type MediaKind, prisma } from "@zoonk/db";

const cachedListMedia = cacheAdminData(
  async (limit: number, offset: number, kind?: MediaKind, visibility?: LibraryVisibility) => {
    const where = { kind, visibility };

    const [assets, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        include: { _count: { select: { steps: true } } },
        omit: { prompt: true, scene: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
        where,
      }),
      prisma.mediaAsset.count({ where }),
    ]);

    return { assets, total };
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
