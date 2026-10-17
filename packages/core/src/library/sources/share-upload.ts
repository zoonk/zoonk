import "server-only";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { buildSourceIdentityKey } from "@zoonk/utils/identity-key";
import { getKnownReusePolicy } from "./reuse-policy";
import { deleteUploadedBlob } from "./upload-blob";

export type ShareUploadInput = {
  sourceId: string;
  /** The document's language, which can differ from the uploader's. */
  language: string;
  publisher: string | null;
  title: string;
  /** Where the publisher offers the document, found by the confirming search. */
  url: string | null;
};

export type SharedUpload = { merged: boolean; sourceId: string };

/**
 * Moves every learner who uploaded the private copy onto the public one. A
 * learner already linked to it keeps that link, since one link per source is
 * enough.
 */
async function mergeIntoPublicSource({
  privateSourceId,
  publicSourceId,
}: {
  privateSourceId: string;
  publicSourceId: string;
}) {
  const linkedUserIds = await prisma.learnerSource.findMany({
    select: { userId: true },
    where: { sourceId: publicSourceId },
  });

  await prisma.$transaction([
    prisma.learnerSource.deleteMany({
      where: {
        sourceId: privateSourceId,
        userId: { in: linkedUserIds.map((link) => link.userId) },
      },
    }),
    prisma.learnerSource.updateMany({
      data: { sourceId: publicSourceId },
      where: { sourceId: privateSourceId },
    }),
    prisma.source.delete({ where: { id: privateSourceId } }),
  ]);
}

/**
 * Shares an upload the visibility check confirmed its publisher made public,
 * such as an exam notice, so the next learner who uploads it gets its
 * blueprint at once. It no longer belongs to its uploader, so deleting their
 * account keeps it for everyone else. When another learner's copy was shared
 * first, this copy merges into it and its file is removed.
 */
export async function shareSourceUpload(input: ShareUploadInput): Promise<SharedUpload | null> {
  const source = await prisma.source.findUnique({
    omit: { extractedText: true },
    where: { id: input.sourceId },
  });

  if (source?.kind !== "upload" || source.visibility !== "private") {
    return null;
  }

  const publicCopy = await prisma.source.findFirst({
    select: { id: true },
    where: { contentHash: source.contentHash, visibility: "public" },
  });

  if (publicCopy) {
    await mergeIntoPublicSource({ privateSourceId: source.id, publicSourceId: publicCopy.id });

    if (source.blobUrl) {
      await deleteUploadedBlob(source.blobUrl);
    }

    return { merged: true, sourceId: publicCopy.id };
  }

  const shared = await safeAsync(() =>
    prisma.source.update({
      data: {
        identityKey: buildSourceIdentityKey({ contentHash: source.contentHash, url: null }),
        language: input.language,
        ownerId: null,
        publisher: input.publisher,
        reusePolicy:
          getKnownReusePolicy({ publisher: input.publisher, url: input.url }) ?? undefined,
        title: input.title,
        url: input.url,
        visibility: "public",
      },
      where: { id: source.id },
    }),
  );

  // Another learner's copy was shared at the same moment: merge into it instead.
  if (shared.error && isPrismaUniqueConstraintError(shared.error)) {
    return shareSourceUpload(input);
  }

  if (shared.error) {
    throw shared.error;
  }

  return { merged: false, sourceId: source.id };
}
