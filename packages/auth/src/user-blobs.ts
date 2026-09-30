import { del, list } from "@vercel/blob";
import { prisma } from "@zoonk/db";
import { getEnvironment } from "@zoonk/utils/environment";
import { getPrivateBlobStore, isPrivateBlobStoreConfigured } from "@zoonk/utils/private-blob-store";
import { getPrivateImageFolder, getUserBlobFolders } from "@zoonk/utils/user-blobs";

/** The Blob API lists and deletes up to 1,000 files per call. */
const PAGE_SIZE = 1000;

/**
 * An upload whose publisher made it public, such as an exam notice, is shared with every learner and
 * no longer belongs to its uploader, so it stays when they go.
 */
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

/**
 * A guest's private course moves to the account they sign up with, and its pictures stay in the
 * guest's folder, so the account's own rows find them.
 */
async function deleteMovedPictures(userId: string): Promise<void> {
  const pictures = await prisma.mediaAsset.findMany({
    select: { url: true },
    where: { NOT: { url: { contains: `/${getPrivateImageFolder(userId)}` } }, ownerId: userId },
  });

  if (pictures.length > 0) {
    await del(
      pictures.map((picture) => picture.url),
      getPrivateBlobStore(),
    );
  }
}

/**
 * Deletes every private file a learner owns (source uploads, kept speech recordings and their
 * private courses' pictures) before the account goes: rows that point at them cascade away with the
 * user, and nothing else would ever find the files again. Deleting is idempotent, so a retried
 * account deletion finishes it. Without a private store nothing private was ever stored, and E2E
 * servers never reach the Blob store, like every other request that leaves the process.
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
