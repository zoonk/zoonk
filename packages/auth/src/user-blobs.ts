import { del, list } from "@vercel/blob";
import { prisma } from "@zoonk/db";
import { getEnvironment } from "@zoonk/utils/environment";
import { getPrivateBlobStore, isPrivateBlobStoreConfigured } from "@zoonk/utils/private-blob-store";
import { getPrivateImageFolder, getUserBlobFolders } from "@zoonk/utils/user-blobs";

/** The Blob API lists and deletes up to 1,000 files per call. */
const PAGE_SIZE = 1000;

/** A public upload, such as an exam notice, is shared with every learner, so it stays when its uploader goes. */
async function withoutSharedUploads(urls: string[]): Promise<string[]> {
  const shared = await prisma.source.findMany({
    select: { blobUrl: true },
    where: { blobUrl: { in: urls }, visibility: "public" },
  });

  const sharedUrls = new Set(shared.map((source) => source.blobUrl));

  return urls.filter((url) => !sharedUrls.has(url));
}

async function deleteFolderPage({
  cursor,
  prefix,
}: {
  cursor?: string;
  prefix: string;
}): Promise<void> {
  const store = getPrivateBlobStore();
  const page = await list({ cursor, limit: PAGE_SIZE, prefix, ...store });
  const urls = await withoutSharedUploads(page.blobs.map((blob) => blob.url));

  if (urls.length > 0) {
    await del(urls, store);
  }

  if (page.hasMore && page.cursor) {
    await deleteFolderPage({ cursor: page.cursor, prefix });
  }
}

/** Pictures of a course moved from a guest stay in the guest's folder. */
async function deleteMovedPictures(userId: string): Promise<void> {
  const [pictures, maps] = await Promise.all([
    prisma.mediaAsset.findMany({ select: { url: true }, where: { ownerId: userId } }),
    prisma.chapterMindMap.findMany({
      select: { imageUrl: true, thumbnailUrl: true },
      where: { chapter: { ownerId: userId, visibility: "private" } },
    }),
  ]);

  const ownFolder = `/${getPrivateImageFolder(userId)}`;

  const moved = [
    ...pictures.map((picture) => picture.url),
    ...maps.flatMap((map) => [map.imageUrl, map.thumbnailUrl]),
  ].filter((url): url is string => url !== null && !url.includes(ownFolder));

  if (moved.length > 0) {
    await del(moved, getPrivateBlobStore());
  }
}

/**
 * Call before the account goes: its rows cascade away with it and nothing else would find the files
 * again. Idempotent, so a retried account deletion finishes it.
 */
export async function deleteUserBlobs(userId: string): Promise<void> {
  if (!isPrivateBlobStoreConfigured() || getEnvironment() === "e2e") {
    return;
  }

  await Promise.all([
    ...getUserBlobFolders(userId).map((prefix) => deleteFolderPage({ prefix })),
    deleteMovedPictures(userId),
  ]);
}
