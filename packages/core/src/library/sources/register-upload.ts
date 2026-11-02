import "server-only";
import { randomUUID } from "node:crypto";
import { type Source, prisma } from "@zoonk/db";
import { buildSourceIdentityKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { isUuid } from "@zoonk/utils/uuid";
import { claimUsage } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getSession } from "../../users/get-session";
import { libraryRowsVisibleTo } from "../_utils/library-visibility";
import { getUploadClaimId, isOwnUploadPathname } from "./create-upload-token";
import { toSourceUrl } from "./fetch-document";
import { type UploadContent, type UploadRead, getDefaultTitle, readUpload } from "./read-upload";
import { deleteUploadedBlob } from "./upload-blob";

type UploadedSource = Omit<Source, "extractedText">;

export type SourceUploadInput = {
  goalId?: string | null;
  language: string;
  title?: string | null;
} & UploadRead;

export type SourceUploadResult =
  | { status: "unauthorized" }
  | { status: "invalidPathname" }
  | { status: "notFound" }
  | { status: "unsupported" }
  | RefusedUsage
  | { checkVisibility: boolean; source: UploadedSource; status: "ready" };

async function linkUpload({
  goalId,
  sourceId,
  uploadId,
  userId,
}: {
  goalId: string | null;
  sourceId: string;
  uploadId: string;
  userId: string;
}) {
  await writeLearnerChange({ userId }, async (tx) => {
    const uploads = await tx.sourceUpload.createMany({
      data: { id: uploadId, sourceId, userId },
      skipDuplicates: true,
    });

    const { count } = await tx.learnerSource.createMany({
      data: { goalId, origin: "upload", sourceId, userId },
      skipDuplicates: true,
    });

    if (count > 0) {
      return null;
    }

    const uploaded = await tx.learnerSource.updateMany({
      data: { origin: "upload" },
      where: { origin: { not: "upload" }, sourceId, userId },
    });

    return uploaded.count + uploads.count === 0 ? unchanged(null) : null;
  });
}

function findStoredCopy({ hash, userId }: { hash: string; userId: string }) {
  return prisma.source.findFirst({
    omit: { extractedText: true },
    orderBy: { createdAt: "asc" },
    where: { ...libraryRowsVisibleTo(userId), contentHash: hash },
  });
}

async function hasUploaded({ hash, userId }: { hash: string; userId: string }): Promise<boolean> {
  const uploads = await prisma.learnerSource.count({
    where: { origin: "upload", source: { contentHash: hash }, userId },
  });

  return uploads > 0;
}

async function getOwnGoalId({ goalId, userId }: { goalId?: string | null; userId: string }) {
  if (!goalId || !isUuid(goalId)) {
    return null;
  }

  const goal = await prisma.goal.findFirst({ select: { id: true }, where: { id: goalId, userId } });

  return goal?.id ?? null;
}

function createPrivateSource({
  content,
  input,
  userId,
}: {
  content: UploadContent;
  input: SourceUploadInput;
  userId: string;
}) {
  const identityKey = scopeIdentityKey({
    key: buildSourceIdentityKey({ contentHash: content.hash, url: null }),
    ownerId: userId,
  });

  const title = input.title?.trim() || getDefaultTitle(input);

  return writeLearnerChange({ userId }, async (tx) => {
    const stored = await tx.source.findUnique({
      omit: { extractedText: true },
      where: { languageIdentity: { identityKey, language: input.language } },
    });

    if (stored) {
      return unchanged({ created: false, source: stored });
    }

    const source = await tx.source.create({
      data: {
        blobUrl: content.blobUrl,
        contentHash: content.hash,
        extractedText: content.parsed.text,
        fetchedAt: new Date(),
        identityKey,
        kind: "upload",
        language: input.language,
        mimeType: content.contentType,
        ownerId: userId,
        structure: {
          images: content.parsed.images.length,
          pages: content.parsed.pages,
          topic: null,
        },
        title,
        url: content.url ?? null,
        visibility: "private",
      },
      omit: { extractedText: true },
    });

    await oweFollowUps({
      db: tx,
      followUps: [{ input: { sourceId: source.id }, kind: "checkUploadVisibility" }],
      userId,
    });

    return { created: true, source };
  });
}

type UsageRefusal = RefusedUsage | { status: "unauthorized" };

async function claimUpload(targetId: string): Promise<UsageRefusal | null> {
  const decision = await claimUsage({ kind: "upload", targetId });

  return decision.status === "allowed" ? null : decision;
}

function getSentUploadId({ input, userId }: { input: UploadRead; userId: string }) {
  if (input.kind === "file") {
    return getUploadClaimId(input.pathname);
  }

  const url = input.kind === "link" ? toSourceUrl(input.url) : null;

  return url ? getUploadClaimId(`${userId}:${url}`) : null;
}

async function removeUnusedBlob({
  content,
  storedBlobUrl,
}: {
  content: UploadContent;
  storedBlobUrl: string | null;
}): Promise<void> {
  if (content.blobUrl && content.blobUrl !== storedBlobUrl) {
    await deleteUploadedBlob(content.blobUrl);
  }
}

async function storeUpload({
  claimId,
  content,
  input,
  uploadId,
  userId,
}: {
  /** Null when the request claimed its upload before reading it. */
  claimId: string | null;
  content: UploadContent;
  input: SourceUploadInput;
  uploadId: string;
  userId: string;
}): Promise<SourceUploadResult> {
  const [goalId, storedCopy, uploadedBefore] = await Promise.all([
    getOwnGoalId({ goalId: input.goalId, userId }),
    findStoredCopy({ hash: content.hash, userId }),
    hasUploaded({ hash: content.hash, userId }),
  ]);

  const refusal = claimId && !uploadedBefore ? await claimUpload(claimId) : null;

  if (refusal) {
    await removeUnusedBlob({ content, storedBlobUrl: storedCopy?.blobUrl ?? null });
    return refusal;
  }

  const { created, source } = storedCopy
    ? { created: false, source: storedCopy }
    : await createPrivateSource({ content, input, userId });

  await linkUpload({ goalId, sourceId: source.id, uploadId, userId });
  await removeUnusedBlob({ content, storedBlobUrl: source.blobUrl });

  return { checkVisibility: created, source, status: "ready" };
}

/**
 * An upload sent again answers with the source it became: its file may be gone, and its text may
 * be stored nowhere once a shared copy moved to a newer edition.
 */
async function answerSentUpload({
  input,
  uploadId,
  userId,
}: {
  input: SourceUploadInput;
  uploadId: string;
  userId: string;
}): Promise<SourceUploadResult | null> {
  const upload = await prisma.sourceUpload.findFirst({
    include: { source: { omit: { extractedText: true } } },
    where: { id: uploadId, userId },
  });

  if (!upload) {
    return null;
  }

  const goalId = await getOwnGoalId({ goalId: input.goalId, userId });
  await linkUpload({ goalId, sourceId: upload.sourceId, uploadId, userId });

  return { checkVisibility: false, source: upload.source, status: "ready" };
}

export async function registerSourceUpload(input: SourceUploadInput): Promise<SourceUploadResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  if (input.kind === "file" && !isOwnUploadPathname({ pathname: input.pathname, userId })) {
    return { status: "invalidPathname" };
  }

  const sentId = getSentUploadId({ input, userId });
  const sentBefore = sentId ? await answerSentUpload({ input, uploadId: sentId, userId }) : null;

  if (sentBefore) {
    return sentBefore;
  }

  // Each download of a link takes its own claim, so one claim never pays for two downloads. A file
  // was claimed when its upload was signed, and pasted text costs nothing to read.
  const refusal = input.kind === "link" && sentId ? await claimUpload(randomUUID()) : null;

  if (refusal) {
    return refusal;
  }

  const read = await readUpload(input);

  if (read.status !== "ready") {
    return read;
  }

  const uploadId = sentId ?? getUploadClaimId(`${userId}:${read.content.hash}`);
  const sent = sentId ? null : await answerSentUpload({ input, uploadId, userId });

  const claimId = input.kind === "link" ? null : uploadId;

  return sent ?? storeUpload({ claimId, content: read.content, input, uploadId, userId });
}
