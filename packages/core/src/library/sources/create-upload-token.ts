import "server-only";
import { type IssuedSignedToken, issueSignedToken } from "@vercel/blob";
import { getPrivateBlobStore } from "@zoonk/utils/private-blob-store";
import { getSourceUploadFolder, isFileInFolder } from "@zoonk/utils/user-blobs";
import { type AllowanceItem } from "../../entitlements/contract";
import { getAllowance } from "../../entitlements/get-allowance";
import { getSession } from "../../users/get-session";
import { MAX_SOURCE_UPLOAD_BYTES, SOURCE_UPLOAD_CONTENT_TYPES } from "./source-contract";

/** Long enough to upload a 20 MB file on a slow phone connection, short enough to be useless if leaked. */
const TOKEN_LIFETIME_MINUTES = 15;
const TOKEN_LIFETIME_MS = TOKEN_LIFETIME_MINUTES * 60 * 1000;

/**
 * How the signed upload URL stores the file: under a random suffix, so two files with the same name
 * never replace each other.
 */
const UPLOAD_URL_OPTIONS = { addRandomSuffix: true };

export type SourceUploadToken =
  | { status: "unauthorized" }
  | { status: "invalidPathname" }
  | { limit: number; status: "limitReached" }
  | { status: "ready"; token: IssuedSignedToken; urlOptions: typeof UPLOAD_URL_OPTIONS };

/** The cap the learner hit: today's uploads for accounts, none at all for guests. */
function getHardLimit(item: AllowanceItem): number {
  return item.dailyLimit ?? item.monthlyLimit ?? item.totalLimit ?? 0;
}

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
 * Signs the upload a browser or app sends straight to the private Blob store, since function
 * requests are capped at 4.5 MB. The signature only accepts this file in the learner's own folder,
 * the supported types and the size limit, and it's refused once the plan's uploads are used up (the
 * claim happens when the file is registered, so a failed upload costs nothing). Signing works with
 * the deployment's OIDC credentials, so no long-lived store token is needed on Vercel.
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

  const userId = session.user.id;

  if (!isOwnUploadPathname({ pathname, userId })) {
    return { status: "invalidPathname" };
  }

  const allowance = await getAllowance();
  const uploads = allowance?.items.find((item) => item.kind === "upload");

  if (uploads?.remaining === 0) {
    return { limit: getHardLimit(uploads), status: "limitReached" };
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
