import "server-only";
import { randomUUID } from "node:crypto";
import { type Source, prisma } from "@zoonk/db";
import { buildSourceIdentityKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { isUuid } from "@zoonk/utils/uuid";
import { claimUsage } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
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

async function linkLearnerSource({
  goalId,
  sourceId,
  userId,
}: {
  goalId: string | null;
  sourceId: string;
  userId: string;
}) {
  await writeLearnerChange({ userId }, async (tx) => {
    const { count } = await tx.learnerSource.createMany({
      data: { goalId, origin: "upload", sourceId, userId },
      skipDuplicates: true,
    });

    return count === 0 ? unchanged(null) : null;
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
      return unchanged(stored);
    }

    return tx.source.create({
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
  });
}

type UsageRefusal = RefusedUsage | { status: "unauthorized" };

async function claimUpload(targetId: string): Promise<UsageRefusal | null> {
  const decision = await claimUsage({ kind: "upload", targetId });

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

  const uploadId = input.kind === "file" ? getUploadClaimId(input.pathname) : randomUUID();
  const sourceId = storedCopy?.id ?? uploadId;
  const refusal = await claimUpload(input.kind === "file" ? uploadId : sourceId);

  if (refusal || storedCopy) {
    await removeUnusedBlob({ content, storedBlobUrl: storedCopy?.blobUrl ?? null });
  }

  if (refusal) {
    return refusal;
  }

  if (storedCopy) {
    await linkLearnerSource({ goalId, sourceId: storedCopy.id, userId });
    return { checkVisibility: false, source: storedCopy, status: "ready" };
  }

  const source = await createPrivateSource({ content, id: sourceId, input, userId });
  await linkLearnerSource({ goalId, sourceId: source.id, userId });

  return { checkVisibility: true, source, status: "ready" };
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

  const read = await readUpload(input);

  if (read.status !== "ready") {
    return read;
  }

  return storeUpload({ content: read.content, input, userId });
}
