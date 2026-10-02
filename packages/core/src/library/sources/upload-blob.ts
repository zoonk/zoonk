import "server-only";
import { del, get } from "@vercel/blob";
import { getPrivateBlobStore } from "@zoonk/utils/private-blob-store";
import { normalizeContentType } from "@zoonk/utils/upload";
import { MAX_SOURCE_UPLOAD_BYTES } from "./source-contract";

/**
 * Uploads are in the private store: the server reads them with the store's credentials, and a
 * public upload is shared through its source row, never its blob URL.
 */
const UPLOAD_ACCESS = "private";

export type UploadedBlob = { bytes: Uint8Array; contentType: string; url: string };

/** Reads an uploaded file, or null when it doesn't exist or is over the size limit. */
export async function readUploadedBlob(urlOrPathname: string): Promise<UploadedBlob | null> {
  const result = await get(urlOrPathname, {
    access: UPLOAD_ACCESS,
    useCache: false,
    ...getPrivateBlobStore(),
  });

  // A 304 has no stream; uploads are read without a cached copy, so it never applies.
  if (!result?.stream || result.blob.size > MAX_SOURCE_UPLOAD_BYTES) {
    return null;
  }

  const bytes = new Uint8Array(await new Response(result.stream).arrayBuffer());

  return {
    bytes,
    contentType: normalizeContentType(result.blob.contentType),
    url: result.blob.url,
  };
}

/** Removes a file that became a duplicate of a stored source, so storage holds each document once. */
export async function deleteUploadedBlob(url: string): Promise<void> {
  await del(url, getPrivateBlobStore());
}
