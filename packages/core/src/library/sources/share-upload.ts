import "server-only";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { buildSourceIdentityKey } from "@zoonk/utils/identity-key";
import { canCheckUploadVisibility } from "./load-source-documents";
import { getKnownReusePolicy } from "./reuse-policy";
import { SOURCE_READ_VERSION } from "./source-contract";
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
    // Learner writes, such as answering an ask with the upload, lock the learner first; so does
    // this, so one answered meanwhile is carried over and neither waits on the other's links.
    prisma.$queryRaw`
      SELECT id FROM users
      WHERE id IN (SELECT user_id FROM learner_sources WHERE source_id = ${privateSourceId}::uuid)
      ORDER BY id FOR NO KEY UPDATE
    `,
    // A lesson write waiting to save what it read from the upload saves it before the move, or
    // finds the upload gone.
    prisma.$queryRaw`SELECT id FROM sources WHERE id = ${privateSourceId}::uuid FOR UPDATE`,
    // Clients keep the id the upload returned, in drafts and in screens still open.
    prisma.$executeRaw`
      INSERT INTO source_redirects (from_id, to_id, user_id)
      SELECT id, ${publicSourceId}::uuid, owner_id FROM sources
      WHERE id = ${privateSourceId}::uuid AND owner_id IS NOT NULL
    `,
    // A goal that already reads the shared copy keeps that link, which takes on the upload and the
    // ask it answered, so sending it again can't answer that goal's ask twice.
    prisma.$executeRaw`
      INSERT INTO goal_sources (goal_id, source_id, origin, answered_at, created_at)
      SELECT goal_id, ${publicSourceId}::uuid, origin, answered_at, created_at FROM goal_sources
      WHERE source_id = ${privateSourceId}::uuid
      ON CONFLICT (goal_id, source_id) DO UPDATE
      SET origin = CASE WHEN EXCLUDED.origin = 'upload' THEN EXCLUDED.origin ELSE goal_sources.origin END,
        answered_at = GREATEST(goal_sources.answered_at, EXCLUDED.answered_at)
    `,
    prisma.stepSource.deleteMany({
      where: {
        sourceId: privateSourceId,
        step: { sources: { some: { sourceId: publicSourceId } } },
      },
    }),
    prisma.stepSource.updateMany({
      data: { sourceId: publicSourceId },
      where: { sourceId: privateSourceId },
    }),
    // A learner who already follows the shared copy keeps that link, which takes on their upload.
    prisma.$executeRaw`
      UPDATE learner_sources AS kept
      SET origin = 'upload'
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
        readState: null,
        readVersion: SOURCE_READ_VERSION,
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
    select: {
      blobUrl: true,
      contentHash: true,
      kind: true,
      readState: true,
      structure: true,
      visibility: true,
    },
    where: { id: input.sourceId },
  });

  if (!upload || !canCheckUploadVisibility(upload)) {
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
