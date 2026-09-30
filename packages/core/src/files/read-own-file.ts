import "server-only";
import { get } from "@vercel/blob";
import { prisma } from "@zoonk/db";
import { getPrivateBlobStore } from "@zoonk/utils/private-blob-store";
import { isOwnPrivateFile } from "@zoonk/utils/user-blobs";
import { getSession } from "../users/get-session";

export type OwnFile =
  | { status: "unauthorized" }
  | { status: "notFound" }
  | { etag: string; status: "notModified" }
  | { contentType: string; etag: string; status: "ready"; stream: ReadableStream<Uint8Array> };

type ServedOwnFile = Extract<OwnFile, { status: "notModified" | "ready" }>;

/**
 * The browser may keep a private file, a shared cache never may, and every use asks again with
 * the owner's session: an unchanged file then costs a 304, not a download.
 */
const OWN_FILE_CACHE_CONTROL = "private, no-cache";

/**
 * A guest's private course moves to the account they sign up with, and its pictures stay in the
 * guest's folder, so the account's own rows say which of those files are now theirs.
 */
async function ownsMovedPicture({ pathname, userId }: { pathname: string; userId: string }) {
  const picture = await prisma.mediaAsset.findFirst({
    select: { id: true },
    where: { ownerId: userId, url: { endsWith: `/${pathname}` } },
  });

  return picture !== null;
}

async function canReadFile({ pathname, userId }: { pathname: string; userId: string }) {
  return isOwnPrivateFile({ pathname, userId }) || ownsMovedPicture({ pathname, userId });
}

/**
 * Reads one of the signed-in learner's own private files (a private course's picture or an upload)
 * for the file routes. Another learner's file is "not found" rather than
 * "forbidden", so whether it exists isn't revealed. With the ETag the browser kept, an unchanged
 * file answers "not modified" without being downloaded again.
 */
export async function readOwnFile({
  ifNoneMatch,
  pathname,
}: {
  ifNoneMatch: string | null;
  pathname: string;
}): Promise<OwnFile> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!(await canReadFile({ pathname, userId: session.user.id }))) {
    return { status: "notFound" };
  }

  const result = await get(pathname, {
    access: "private",
    ifNoneMatch: ifNoneMatch ?? undefined,
    ...getPrivateBlobStore(),
  });

  if (!result) {
    return { status: "notFound" };
  }

  // Only a 304, for a browser whose copy is current, comes without a body.
  if (result.stream === null) {
    return { etag: result.blob.etag, status: "notModified" };
  }

  return {
    contentType: result.blob.contentType,
    etag: result.blob.etag,
    status: "ready",
    stream: result.stream,
  };
}

/**
 * The file route's answer, the same in every app so a private file is cached the same way
 * wherever it's read.
 */
export function toOwnFileResponse(file: ServedOwnFile): Response {
  if (file.status === "notModified") {
    return new Response(null, {
      headers: { "Cache-Control": OWN_FILE_CACHE_CONTROL, ETag: file.etag },
      status: 304,
    });
  }

  return new Response(file.stream, {
    headers: {
      "Cache-Control": OWN_FILE_CACHE_CONTROL,
      "Content-Type": file.contentType,
      ETag: file.etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
