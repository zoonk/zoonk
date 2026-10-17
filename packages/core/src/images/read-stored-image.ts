import "server-only";
import { get } from "@vercel/blob";
import { getPrivateBlobStore } from "@zoonk/utils/private-blob-store";
import { getPrivateBlobPathname } from "@zoonk/utils/user-blobs";

export type StoredImage = { data: Uint8Array; mediaType: string };

const DEFAULT_MEDIA_TYPE = "image/webp";

async function readPrivateImage(pathname: string): Promise<StoredImage> {
  const result = await get(pathname, {
    access: "private",
    useCache: false,
    ...getPrivateBlobStore(),
  });

  if (!result?.stream) {
    throw new Error(`The stored picture ${pathname} couldn't be read.`);
  }

  return {
    data: new Uint8Array(await new Response(result.stream).arrayBuffer()),
    mediaType: result.blob.contentType,
  };
}

async function readPublicImage(url: string): Promise<StoredImage> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`The stored picture ${url} couldn't be read (${response.status}).`);
  }

  return {
    data: new Uint8Array(await response.arrayBuffer()),
    mediaType: response.headers.get("content-type") ?? DEFAULT_MEDIA_TYPE,
  };
}

/**
 * Reads a stored picture back, for a check that runs after it was shown: a shared picture from the
 * public store by its URL, a private one (a private course's or a learner's) from the private store
 * with its credentials. Throws when it can't be read, so the check's step retries.
 */
export async function readStoredImage({ url }: { url: string }): Promise<StoredImage> {
  const pathname = getPrivateBlobPathname(url);
  return pathname ? readPrivateImage(pathname) : readPublicImage(url);
}
