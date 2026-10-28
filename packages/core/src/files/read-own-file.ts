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

/** Private files may be cached only by the browser, which must revalidate with the owner's session. */
const OWN_FILE_CACHE_CONTROL = "private, no-cache";

/** Guest signup moves ownership without moving files out of the guest's folder. */
async function ownsMovedPicture({ pathname, userId }: { pathname: string; userId: string }) {
  const picture = await prisma.mediaAsset.findFirst({
    select: { id: true },
    where: { ownerId: userId, url: { endsWith: `/${pathname}` } },
  });

  return picture !== null;
}

async function ownsMovedMindMap({ pathname, userId }: { pathname: string; userId: string }) {
  const url = { endsWith: `/${pathname}` };

  const map = await prisma.chapterMindMap.findFirst({
    select: { id: true },
    where: { OR: [{ imageUrl: url }, { thumbnailUrl: url }], chapter: { ownerId: userId } },
  });

  return map !== null;
}

async function canReadFile({ pathname, userId }: { pathname: string; userId: string }) {
  return (
    isOwnPrivateFile({ pathname, userId }) ||
    (await ownsMovedPicture({ pathname, userId })) ||
    ownsMovedMindMap({ pathname, userId })
  );
}

/** Requires a session; another learner's file returns notFound. Matching ETags return notModified without downloading. */
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
