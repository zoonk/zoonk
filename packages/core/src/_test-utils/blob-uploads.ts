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

export function storeBlobUploads({ url }: { url?: string } = {}): void {
  vi.mocked(put).mockImplementation(async (pathname) =>
    storedAt({ pathname, url: url ?? `https://blob.test/${randomUUID()}-${pathname}` }),
  );
}

export function serveStoredFile(file: { data: Uint8Array; mediaType: string }) {
  const read = vi.fn(
    async (_url: string) =>
      new Response(new Uint8Array(file.data), { headers: { "content-type": file.mediaType } }),
  );

  vi.stubGlobal("fetch", read);
  return read;
}
