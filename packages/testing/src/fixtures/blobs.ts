const HTTP_OK = 200;

function metadata(pathname: string, bytes: Uint8Array) {
  const url = `https://blob.test/${pathname}`;

  return {
    cacheControl: "no-cache",
    contentDisposition: "inline",
    contentType: "application/octet-stream",
    downloadUrl: url,
    etag: "test-etag",
    pathname,
    size: bytes.byteLength,
    uploadedAt: new Date(),
    url,
  };
}

export function blobStoreFixture(NotFound: new () => Error) {
  const stored = new Map<string, Uint8Array<ArrayBuffer>>();

  return {
    get: async (pathname: string) => {
      const bytes = stored.get(pathname);

      if (!bytes) {
        return null;
      }

      return {
        blob: metadata(pathname, bytes),
        headers: new Headers(),
        statusCode: HTTP_OK as typeof HTTP_OK,
        stream: new Blob([bytes]).stream(),
      };
    },

    head: async (pathname: string) => {
      const bytes = stored.get(pathname);

      if (!bytes) {
        throw new NotFound();
      }

      return metadata(pathname, bytes);
    },

    put: async (pathname: string, body: unknown) => {
      if (typeof body !== "string" && !(body instanceof Uint8Array)) {
        throw new TypeError("Expected text or audio bytes");
      }

      const bytes =
        typeof body === "string" ? new TextEncoder().encode(body) : Uint8Array.from(body);

      stored.set(pathname, bytes);
      return metadata(pathname, bytes);
    },
  };
}
