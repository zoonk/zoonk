import "server-only";
import { randomUUID } from "node:crypto";
import { type Source, prisma } from "@zoonk/db";
import { buildSourceIdentityKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { isUuid } from "@zoonk/utils/uuid";
import { claimUsage } from "../../entitlements/claim-usage";
import { type AllowanceLimit } from "../../entitlements/contract";
import { getSession } from "../../users/get-session";
import { libraryRowsVisibleTo } from "../_utils/library-visibility";
import { isOwnUploadPathname } from "./create-upload-token";
import { type UploadContent, type UploadRead, getDefaultTitle, readUpload } from "./read-upload";
import { deleteUploadedBlob } from "./upload-blob";

type UploadedSource = Omit<Source, "extractedText">;

export type SourceUploadInput = {
  goalId?: string | null;
  /** The learner's language, used when the document doesn't say its own. */
  language: string;
  title?: string | null;
} & UploadRead;

export type SourceUploadResult =
  | { status: "unauthorized" }
  | { status: "invalidPathname" }
  | { status: "notFound" }
  | { status: "unsupported" }
  | { limit: AllowanceLimit; status: "limitReached" }
  | { retryAfterSeconds: number; status: "slowDown" }
  | { checkVisibility: boolean; source: UploadedSource; status: "ready" };

/** Links the learner to a source and returns it; a second link to the same source is a no-op. */
async function linkLearnerSource({
  goalId,
  sourceId,
  userId,
}: {
  goalId: string | null;
  sourceId: string;
  userId: string;
}) {
  await prisma.learnerSource.upsert({
    create: { goalId, origin: "upload", sourceId, userId },
    update: {},
    where: { learnerSource: { sourceId, userId } },
  });
}

/** A public copy of the same document, or the learner's own earlier upload of it. */
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

  // Concurrent registrations of one file by one learner land on the same row.
  return prisma.source.upsert({
    create: {
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
      structure: { images: content.parsed.images.length, pages: content.parsed.pages, topic: null },
      title,
      url: content.url ?? null,
      visibility: "private",
    },
    omit: { extractedText: true },
    update: {},
    where: { languageIdentity: { identityKey, language: input.language } },
  });
}

type UsageRefusal = Extract<
  SourceUploadResult,
  { status: "limitReached" | "slowDown" | "unauthorized" }
>;

/**
 * Counts the upload against the learner's plan before it's stored. Uploading
 * a document already stored for them claims the same target again, which is
 * free.
 */
async function claimUpload(targetId: string): Promise<UsageRefusal | null> {
  const decision = await claimUsage({ kind: "upload", targetId });

  return decision.status === "allowed" ? null : decision;
}

/**
 * A refused or duplicate file isn't kept, so storage holds each registered
 * document once. A retried registration of the same file points at the stored
 * copy's own blob, which stays.
 */
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

  const sourceId = storedCopy?.id ?? randomUUID();
  const refusal = await claimUpload(sourceId);

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

/**
 * Stores a file the learner uploaded to their Blob folder, a link or text they
 * pasted, once the plan's upload allowance accepts it. A document already
 * shared publicly (the same exam notice, by hash) is linked instead of stored
 * again, so its blueprint is ready at once. Anything new is private to its
 * owner until the visibility check says its publisher made it public.
 */
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
