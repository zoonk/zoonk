import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

/** The detail page lists the first users of an asset; the heading carries the full count. */
export const MAX_MEDIA_USAGE_ROWS = 50;

const cachedGetMedia = cacheAdminData(async (mediaAssetId: string) =>
  prisma.mediaAsset.findUnique({
    include: {
      _count: { select: { steps: true } },
      owner: { select: { email: true, id: true, name: true } },
      steps: {
        orderBy: [{ lessonId: "asc" }, { position: "asc" }],
        select: {
          id: true,
          kind: true,
          lesson: { select: { id: true, title: true } },
          position: true,
        },
        take: MAX_MEDIA_USAGE_ROWS,
      },
    },
    where: { id: mediaAssetId },
  }),
);

export type AdminMediaAsset = NonNullable<Awaited<ReturnType<typeof getMedia>>>;

/** One media asset with how it was made and every step that uses it. */
export async function getMedia(mediaAssetId: string) {
  return cachedGetMedia(mediaAssetId);
}
