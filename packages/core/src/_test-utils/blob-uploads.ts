import { randomUUID } from "node:crypto";
import { type PutBlobResult, put } from "@vercel/blob";
import { vi } from "vitest";

function storedAt({ pathname, url }: { pathname: string; url: string }): PutBlobResult {
  return {
    contentDisposition: "inline",
    contentType: "",
    downloadUrl: url,
    etag: "",
    pathname,
    url,
  };
}

/** Vercel Blob keeps each upload at a URL of its own on a test host, or at `url` when given. */
export function storeBlobUploads({ url }: { url?: string } = {}): void {
  vi.mocked(put).mockImplementation(async (pathname) =>
    storedAt({ pathname, url: url ?? `https://blob.test/${randomUUID()}-${pathname}` }),
  );
}

/**
 * The public store serves `file` at every URL, which code reads back with `fetch`. Returns that
 * `fetch`, to check what was read.
 */
export function serveStoredFile(file: { data: Uint8Array; mediaType: string }) {
  const read = vi.fn(
    async (_url: string) =>
      new Response(new Uint8Array(file.data), { headers: { "content-type": file.mediaType } }),
  );

  vi.stubGlobal("fetch", read);
  return read;
}
