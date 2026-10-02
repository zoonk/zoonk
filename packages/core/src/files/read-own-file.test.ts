import { randomUUID } from "node:crypto";
import { get } from "@vercel/blob";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { readOwnFile, toOwnFileResponse } from "./read-own-file";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

// Blob storage is an external service; tests serve the stored file from memory.
vi.mock("@vercel/blob", () => ({ get: vi.fn() }));

const ETAG = '"etag-1"';

function blobInfo(pathname: string) {
  const url = `https://store.private.blob.vercel-storage.com/${pathname}`;

  return {
    cacheControl: "",
    contentDisposition: "",
    downloadUrl: url,
    etag: ETAG,
    pathname,
    uploadedAt: new Date(),
    url,
  };
}

function storedFile({ bytes, pathname }: { bytes: string; pathname: string }) {
  return {
    blob: { ...blobInfo(pathname), contentType: "image/webp", size: bytes.length },
    headers: new Headers(),
    statusCode: 200 as const,
    stream: new Response(bytes).body!,
  };
}

/** What Blob answers when the ETag still matches: no body. */
function unchangedFile(pathname: string) {
  return {
    blob: { ...blobInfo(pathname), contentType: null, size: null },
    headers: new Headers(),
    statusCode: 304 as const,
    stream: null,
  };
}

describe(readOwnFile, () => {
  beforeEach(() => {
    vi.stubEnv("PRIVATE_BLOB_STORE_ID", "store_private");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("asks a visitor without a session to sign in", async () => {
    mockSession(null);

    await expect(
      readOwnFile({ ifNoneMatch: null, pathname: `images/${randomUUID()}/step-a.webp` }),
    ).resolves.toStrictEqual({ status: "unauthorized" });

    expect(get).not.toHaveBeenCalled();
  });

  it("serves the owner's file from the private store, cached only by their browser", async () => {
    const userId = randomUUID();
    const pathname = `images/${userId}/step-a.webp`;
    mockSession(userId);
    vi.mocked(get).mockResolvedValue(storedFile({ bytes: "webp-bytes", pathname }));

    const file = await readOwnFile({ ifNoneMatch: null, pathname });

    expect(get).toHaveBeenCalledWith(pathname, {
      access: "private",
      ifNoneMatch: undefined,
      storeId: "store_private",
      token: undefined,
    });

    if (file.status !== "ready") {
      throw new Error(`Expected the file, got ${file.status}`);
    }

    const response = toOwnFileResponse(file);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("ETag")).toBe(ETAG);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    await expect(response.text()).resolves.toBe("webp-bytes");
  });

  it("serves a guest their own private course's pictures", async () => {
    const guestId = randomUUID();
    const pathname = `images/${guestId}/cover-b.webp`;
    mockGuestSession(guestId);
    vi.mocked(get).mockResolvedValue(storedFile({ bytes: "cover", pathname }));

    await expect(readOwnFile({ ifNoneMatch: null, pathname })).resolves.toMatchObject({
      status: "ready",
    });
  });

  it("answers another learner as if the file didn't exist, without reading it", async () => {
    mockSession(randomUUID());

    const files = await Promise.all(
      [
        `images/${randomUUID()}/step-a.webp`,
        `sources/${randomUUID()}/notes.pdf`,
        `speech/${randomUUID()}/take.webm`,
      ].map((pathname) => readOwnFile({ ifNoneMatch: null, pathname })),
    );

    expect(files).toStrictEqual([
      { status: "notFound" },
      { status: "notFound" },
      { status: "notFound" },
    ]);

    expect(get).not.toHaveBeenCalled();
  });

  it("answers a guest the same way for someone else's file", async () => {
    mockGuestSession(randomUUID());

    await expect(
      readOwnFile({ ifNoneMatch: null, pathname: `images/${randomUUID()}/step-a.webp` }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });

  it("serves an account the pictures of the private course it brought from its guest", async () => {
    const [account, other] = await Promise.all([userFixture(), userFixture()]);
    const pathname = `images/${randomUUID()}/step-${randomUUID()}.webp`;

    await mediaAssetFixture({
      ownerId: account.id,
      url: `https://store.private.blob.vercel-storage.com/${pathname}`,
      visibility: "private",
    });

    vi.mocked(get).mockResolvedValue(storedFile({ bytes: "moved", pathname }));

    mockSession(other.id);

    await expect(readOwnFile({ ifNoneMatch: null, pathname })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(account.id);

    await expect(readOwnFile({ ifNoneMatch: null, pathname })).resolves.toMatchObject({
      status: "ready",
    });
  });

  it("tells the browser its copy is current without downloading the file again", async () => {
    const userId = randomUUID();
    const pathname = `images/${userId}/step-a.webp`;
    mockSession(userId);

    vi.mocked(get).mockResolvedValue(unchangedFile(pathname));

    const file = await readOwnFile({ ifNoneMatch: ETAG, pathname });

    expect(vi.mocked(get).mock.calls[0]?.[1]).toMatchObject({ ifNoneMatch: ETAG });
    expect(file).toStrictEqual({ etag: ETAG, status: "notModified" });

    const response = toOwnFileResponse({ etag: ETAG, status: "notModified" });

    expect(response.status).toBe(304);
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(response.headers.get("ETag")).toBe(ETAG);
  });

  it("finds nothing when the owner's file is gone", async () => {
    const userId = randomUUID();
    mockSession(userId);
    vi.mocked(get).mockResolvedValue(null);

    await expect(
      readOwnFile({ ifNoneMatch: null, pathname: `sources/${userId}/notes.pdf` }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });

  it("refuses to read a learner's file without the private store", async () => {
    vi.stubEnv("PRIVATE_BLOB_STORE_ID", "");
    const userId = randomUUID();
    mockSession(userId);

    await expect(
      readOwnFile({ ifNoneMatch: null, pathname: `images/${userId}/step-a.webp` }),
    ).rejects.toThrow("private Blob store isn't configured");

    expect(get).not.toHaveBeenCalled();
  });
});
