import "server-only";
import { createHash } from "node:crypto";
import { type IssuedSignedToken, issueSignedToken } from "@vercel/blob";
import { getPrivateBlobStore } from "@zoonk/utils/private-blob-store";
import { getSourceUploadFolder, isFileInFolder } from "@zoonk/utils/user-blobs";
import { claimUsage } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { getSession } from "../../users/get-session";
import { MAX_SOURCE_UPLOAD_BYTES, SOURCE_UPLOAD_CONTENT_TYPES } from "./source-contract";

/** Long enough to upload a 20 MB file on a slow phone connection, short enough to be useless if leaked. */
const TOKEN_LIFETIME_MINUTES = 15;
const TOKEN_LIFETIME_MS = TOKEN_LIFETIME_MINUTES * 60 * 1000;

/**
 * How the signed upload URL stores the file: at exactly its path and never over a file already
 * there, so a signature stores one file however often it's sent, and its claim covers that file.
 */
const UPLOAD_URL_OPTIONS = { addRandomSuffix: false, allowOverwrite: false };

/**
 * A hash written as a UUID of version 8 (custom data): its version and variant digits are fixed,
 * so every UUID check accepts it.
 */
const HASH_AS_UUID = /^(?<p1>.{8})(?<p2>.{4}).(?<p3>.{3}).(?<p4>.{3})(?<p5>.{12}).*$/u;

export type SourceUploadToken =
  | { status: "unauthorized" }
  | { status: "invalidPathname" }
  | RefusedUsage
  | { status: "ready"; token: IssuedSignedToken; urlOptions: typeof UPLOAD_URL_OPTIONS };

/** A file name inside the learner's own folder, without climbing out of it. */
export function isOwnUploadPathname({
  pathname,
  userId,
}: {
  pathname: string;
  userId: string;
}): boolean {
  return isFileInFolder({ folder: getSourceUploadFolder(userId), pathname });
}

/**
 * The plan's claim for the file at this path: signing its upload makes it and registering the
 * file finds it again, so the file counts once. A new source from the file takes it as its id.
 */
export function getUploadClaimId(pathname: string): string {
  return createHash("sha256")
    .update(pathname)
    .digest("hex")
    .replace(HASH_AS_UUID, "$<p1>-$<p2>-8$<p3>-8$<p4>-$<p5>");
}

/**
 * Signs the upload a browser or app sends straight to the private Blob store, since function
 * requests are capped at 4.5 MB. The signature only accepts this file in the learner's own folder,
 * the supported types and the size limit. Signing counts the upload against the plan, since a file
 * stored without being registered takes storage all the same (a failed upload counts too); signing
 * the same path again and registering its file count nothing more. Signing works with the
 * deployment's OIDC credentials, so no long-lived store token is needed on Vercel.
 */
export async function createSourceUploadToken({
  pathname,
}: {
  pathname: string;
}): Promise<SourceUploadToken> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isOwnUploadPathname({ pathname, userId: session.user.id })) {
    return { status: "invalidPathname" };
  }

  const decision = await claimUsage({ kind: "upload", targetId: getUploadClaimId(pathname) });

  if (decision.status !== "allowed") {
    return decision;
  }

  const token = await issueSignedToken({
    allowedContentTypes: [...SOURCE_UPLOAD_CONTENT_TYPES],
    maximumSizeInBytes: MAX_SOURCE_UPLOAD_BYTES,
    operations: ["put"],
    pathname,
    validUntil: Date.now() + TOKEN_LIFETIME_MS,
    ...getPrivateBlobStore(),
  });

  return { status: "ready", token, urlOptions: UPLOAD_URL_OPTIONS };
}
