import "server-only";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { buildSourceIdentityKey } from "@zoonk/utils/identity-key";
import { getKnownReusePolicy } from "./reuse-policy";
import { deleteUploadedBlob } from "./upload-blob";
import { fetchAndParse } from "./web-sources";

export type ShareUploadInput = {
  sourceId: string;
  language: string;
  publisher: string | null;
  title: string;
  url: string;
};

export type SharedUpload = { merged: boolean; sourceId: string };

type PublisherCopy = Awaited<ReturnType<typeof fetchAndParse>>;

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
    // An ask answered with the upload meanwhile waits, so its answer is the one carried over.
    prisma.$queryRaw`
      SELECT id FROM learner_sources WHERE source_id = ${privateSourceId}::uuid FOR UPDATE
    `,
    // A learner who already follows the shared copy keeps that link: it takes on their upload and
    // the ask it answered, so sending it again can't answer another ask.
    prisma.$executeRaw`
      UPDATE learner_sources AS kept
      SET origin = 'upload',
        answered_at = COALESCE(kept.answered_at, moved.answered_at),
        goal_id = COALESCE(kept.goal_id, moved.goal_id)
      FROM learner_sources AS moved
      WHERE moved.source_id = ${privateSourceId}::uuid
        AND moved.origin = 'upload'
        AND kept.source_id = ${publicSourceId}::uuid
        AND kept.user_id = moved.user_id
    `,
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
    prisma.sourceUpload.updateMany({
      data: { sourceId: publicSourceId },
      where: { sourceId: privateSourceId },
    }),
    prisma.source.delete({ where: { id: privateSourceId } }),
  ]);
}

function findPublicCopy(contentHash: string) {
  return prisma.source.findFirst({
    select: { id: true },
    where: { contentHash, visibility: "public" },
  });
}

async function publishCopy({
  copy,
  input,
}: {
  copy: PublisherCopy;
  input: ShareUploadInput;
}): Promise<SharedUpload | null> {
  const publicCopy = await findPublicCopy(copy.contentHash);

  if (publicCopy) {
    await mergeIntoPublicSource({ privateSourceId: input.sourceId, publicSourceId: publicCopy.id });
    return { merged: true, sourceId: publicCopy.id };
  }

  const shared = await safeAsync(() =>
    prisma.source.update({
      data: {
        blobUrl: null,
        extractedText: copy.parsed.text,
        fetchedAt: new Date(),
        identityKey: buildSourceIdentityKey({ contentHash: copy.contentHash, url: null }),
        language: input.language,
        mimeType: copy.contentType,
        ownerId: null,
        publisher: input.publisher,
        reusePolicy:
          getKnownReusePolicy({ publisher: input.publisher, url: copy.url }) ?? undefined,
        structure: { images: copy.parsed.images.length, pages: copy.parsed.pages, topic: null },
        title: input.title,
        url: copy.url,
        visibility: "public",
      },
      where: { id: input.sourceId },
    }),
  );

  // Either a share of the same text finished first, or a freshness check moved the copy first
  // shared with this text to a newer edition, which this upload doesn't match: it stays private.
  if (shared.error && isPrismaUniqueConstraintError(shared.error)) {
    return (await findPublicCopy(copy.contentHash)) ? publishCopy({ copy, input }) : null;
  }

  if (shared.error) {
    throw shared.error;
  }

  return { merged: false, sourceId: input.sourceId };
}

/**
 * Shares an upload only when the publisher's copy at `url` reads the same, and then reads only that
 * copy, from its address: the learner's file may carry pages or notes the classifier never read.
 */
export async function shareSourceUpload(input: ShareUploadInput): Promise<SharedUpload | null> {
  const upload = await prisma.source.findUnique({
    select: { blobUrl: true, contentHash: true, kind: true, visibility: true },
    where: { id: input.sourceId },
  });

  if (upload?.kind !== "upload" || upload.visibility !== "private") {
    return null;
  }

  const copy = await fetchAndParse(input.url);

  if (copy.contentHash !== upload.contentHash) {
    return null;
  }

  const shared = await publishCopy({ copy, input });

  if (shared && upload.blobUrl) {
    await deleteUploadedBlob(upload.blobUrl);
  }

  return shared;
}
