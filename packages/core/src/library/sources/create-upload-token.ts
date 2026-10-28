import "server-only";
import { createHash } from "node:crypto";
import { type IssuedSignedToken, issueSignedToken } from "@vercel/blob";
import { getPrivateBlobStore } from "@zoonk/utils/private-blob-store";
import { getSourceUploadFolder, isFileInFolder } from "@zoonk/utils/user-blobs";
import { claimUsage } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { getSession } from "../../users/get-session";
import { MAX_SOURCE_UPLOAD_BYTES, SOURCE_UPLOAD_CONTENT_TYPES } from "./source-contract";

const TOKEN_LIFETIME_MINUTES = 15;
const TOKEN_LIFETIME_MS = TOKEN_LIFETIME_MINUTES * 60 * 1000;

const UPLOAD_URL_OPTIONS = { addRandomSuffix: false, allowOverwrite: false };

const HASH_AS_UUID = /^(?<p1>.{8})(?<p2>.{4}).(?<p3>.{3}).(?<p4>.{3})(?<p5>.{12}).*$/u;

export type SourceUploadToken =
  | { status: "unauthorized" }
  | { status: "invalidPathname" }
  | RefusedUsage
  | { status: "ready"; token: IssuedSignedToken; urlOptions: typeof UPLOAD_URL_OPTIONS };

export function isOwnUploadPathname({
  pathname,
  userId,
}: {
  pathname: string;
  userId: string;
}): boolean {
  return isFileInFolder({ folder: getSourceUploadFolder(userId), pathname });
}

export function getUploadClaimId(pathname: string): string {
  return createHash("sha256")
    .update(pathname)
    .digest("hex")
    .replace(HASH_AS_UUID, "$<p1>-$<p2>-8$<p3>-8$<p4>-$<p5>");
}

/** Direct-to-Blob uploads avoid the platform's 4.5 MB function-request limit; signing counts against the upload allowance. */
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
