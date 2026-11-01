import "server-only";
import { type Source, prisma } from "@zoonk/db";
import { buildSourceIdentityKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { isUuid } from "@zoonk/utils/uuid";
import { getEntitlementViewer } from "../../entitlements/_utils/entitlement-viewer";
import { previewUsageClaim } from "../../entitlements/_utils/reached-usage-limit";
import { claimUsage } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getSession } from "../../users/get-session";
import { libraryRowsVisibleTo } from "../_utils/library-visibility";
import { getUploadClaimId, isOwnUploadPathname } from "./create-upload-token";
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
  fileId,
  goalId,
  sourceId,
  userId,
}: {
  fileId: string | null;
  goalId: string | null;
  sourceId: string;
  userId: string;
}) {
  await writeLearnerChange({ userId }, async (tx) => {
    const files = fileId
      ? await tx.uploadedFile.createMany({
          data: { id: fileId, sourceId, userId },
          skipDuplicates: true,
        })
      : { count: 0 };

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

    return uploaded.count + files.count === 0 ? unchanged(null) : null;
  });
}

function findStoredCopy({ hash, userId }: { hash: string; userId: string }) {
  return prisma.source.findFirst({
    omit: { extractedText: true },
    orderBy: { createdAt: "asc" },
    where: { ...libraryRowsVisibleTo(userId), contentHash: hash },
  });
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
  id,
  input,
  userId,
}: {
  content: UploadContent;
  id: string;
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
        id,
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
      followUps: [{ input: { sourceId: id }, kind: "checkUploadVisibility" }],
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

/** A file was claimed when its upload was signed, and pasted text costs nothing to read. */
async function findLinkRefusal(): Promise<UsageRefusal | null> {
  const viewer = await getEntitlementViewer();

  if (!viewer) {
    return { status: "unauthorized" };
  }

  const decision = await previewUsageClaim({
    kind: "upload",
    tier: viewer.tier,
    userId: viewer.userId,
  });

  return decision.status === "allowed" ? null : decision;
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
  content,
  input,
  userId,
}: {
  content: UploadContent;
  input: SourceUploadInput;
  userId: string;
}): Promise<SourceUploadResult> {
  const [goalId, storedCopy] = await Promise.all([
    getOwnGoalId({ goalId: input.goalId, userId }),
    findStoredCopy({ hash: content.hash, userId }),
  ]);

  const uploadKey = input.kind === "file" ? input.pathname : `${userId}:${content.hash}`;
  const uploadId = getUploadClaimId(uploadKey);
  const sourceId = storedCopy?.id ?? uploadId;
  const refusal = await claimUpload(input.kind === "file" ? uploadId : sourceId);

  if (refusal) {
    await removeUnusedBlob({ content, storedBlobUrl: storedCopy?.blobUrl ?? null });
    return refusal;
  }

  const { created, source } = storedCopy
    ? { created: false, source: storedCopy }
    : await createPrivateSource({ content, id: sourceId, input, userId });

  const fileId = input.kind === "file" ? uploadId : null;
  await linkUpload({ fileId, goalId, sourceId: source.id, userId });
  await removeUnusedBlob({ content, storedBlobUrl: source.blobUrl });

  return { checkVisibility: created, source, status: "ready" };
}

/** A file is removed once its source matches a stored copy or is shared, so a retry answers from the source it became. */
async function replayRegisteredFile({
  input,
  userId,
}: {
  input: SourceUploadInput;
  userId: string;
}): Promise<SourceUploadResult | null> {
  const file =
    input.kind === "file"
      ? await prisma.uploadedFile.findFirst({
          include: { source: { omit: { extractedText: true } } },
          where: { id: getUploadClaimId(input.pathname), userId },
        })
      : null;

  if (!file) {
    return null;
  }

  const goalId = await getOwnGoalId({ goalId: input.goalId, userId });
  await linkUpload({ fileId: null, goalId, sourceId: file.sourceId, userId });

  return { checkVisibility: false, source: file.source, status: "ready" };
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

  const replayed = await replayRegisteredFile({ input, userId });

  if (replayed) {
    return replayed;
  }

  const refusal = input.kind === "link" ? await findLinkRefusal() : null;

  if (refusal) {
    return refusal;
  }

  const read = await readUpload(input);

  if (read.status !== "ready") {
    return read;
  }

  return storeUpload({ content: read.content, input, userId });
}
