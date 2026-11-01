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

type PrivateUpload = { blobUrl: string | null };

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
    prisma.uploadedFile.updateMany({
      data: { sourceId: publicSourceId },
      where: { sourceId: privateSourceId },
    }),
    prisma.source.delete({ where: { id: privateSourceId } }),
  ]);
}

async function removeFile(blobUrl: string | null): Promise<void> {
  if (blobUrl) {
    await deleteUploadedBlob(blobUrl);
  }
}

async function publishCopy({
  copy,
  input,
  upload,
}: {
  copy: PublisherCopy;
  input: ShareUploadInput;
  upload: PrivateUpload;
}): Promise<SharedUpload> {
  const publicCopy = await prisma.source.findFirst({
    select: { id: true },
    where: { contentHash: copy.contentHash, visibility: "public" },
  });

  if (publicCopy) {
    await mergeIntoPublicSource({ privateSourceId: input.sourceId, publicSourceId: publicCopy.id });
    await removeFile(upload.blobUrl);
    return { merged: true, sourceId: publicCopy.id };
  }

  // Without text, the hash covered the bytes, so the learner's file is the publisher's own.
  const blobUrl = copy.parsed.text ? null : upload.blobUrl;

  const shared = await safeAsync(() =>
    prisma.source.update({
      data: {
        blobUrl,
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

  if (shared.error && isPrismaUniqueConstraintError(shared.error)) {
    return publishCopy({ copy, input, upload });
  }

  if (shared.error) {
    throw shared.error;
  }

  if (!blobUrl) {
    await removeFile(upload.blobUrl);
  }

  return { merged: false, sourceId: input.sourceId };
}

/**
 * Shares an upload only when the publisher's copy at `url` reads the same, and then holds only
 * that copy: the learner's file may carry pages or notes the classifier never read.
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

  return publishCopy({ copy, input, upload });
}
