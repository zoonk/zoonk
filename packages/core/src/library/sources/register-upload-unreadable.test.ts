import { randomUUID } from "node:crypto";
import { get } from "@vercel/blob";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { registerSourceUpload } from "./register-upload";
import { MAX_SOURCE_UPLOAD_BYTES } from "./source-contract";
import type * as RateLimitModule from "@zoonk/auth/rate-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

// Blob storage is an external service; tests serve the uploaded file from memory.
vi.mock("@vercel/blob", () => ({ del: vi.fn(), get: vi.fn() }));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimitModule>()),
  isRateLimited: vi.fn(),
}));

function mockStoredFile({
  bytes,
  contentType,
  pathname,
  size = bytes.byteLength,
}: {
  bytes: Uint8Array;
  contentType: string;
  pathname: string;
  size?: number;
}) {
  const url = `https://store.private.blob.vercel-storage.com/${pathname}`;

  vi.mocked(get).mockResolvedValue({
    blob: {
      cacheControl: "",
      contentDisposition: "",
      contentType,
      downloadUrl: url,
      etag: "etag",
      pathname,
      size,
      uploadedAt: new Date(),
      url,
    },
    headers: new Headers(),
    statusCode: 200,
    stream: new Response(new Uint8Array(bytes)).body!,
  });
}

/** The web is external: each test serves the page it needs from memory. */
function servePage(response: Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response),
  );
}

async function signedIn() {
  const user = await userFixture();
  mockSession(user.id);

  return { pathname: (name: string) => `sources/${user.id}/${name}`, user };
}

/** Nothing unreadable is stored or counted against the day's uploads. */
async function expectNothingKept(userId: string) {
  const [sources, usage] = await Promise.all([
    prisma.source.count({ where: { ownerId: userId } }),
    prisma.usageRecord.count({ where: { kind: "upload", userId } }),
  ]);

  expect({ sources, usage }).toStrictEqual({ sources: 0, usage: 0 });
}

describe("uploads that can't be read", () => {
  beforeEach(() => {
    vi.mocked(isRateLimited).mockResolvedValue(false);
    vi.stubEnv("PRIVATE_BLOB_STORE_ID", "store_test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("refuses pasted text that's only whitespace", async () => {
    const { user } = await signedIn();

    await expect(
      registerSourceUpload({ kind: "text", language: "pt", text: "  \n\t " }),
    ).resolves.toStrictEqual({ status: "unsupported" });

    await expectNothingKept(user.id);
  });

  it("says a file is missing when storage has no such file, or it's over the size limit", async () => {
    const { pathname, user } = await signedIn();
    const file = pathname(`notes-${randomUUID()}.md`);

    vi.mocked(get).mockResolvedValue(null);

    await expect(
      registerSourceUpload({ kind: "file", language: "pt", pathname: file }),
    ).resolves.toStrictEqual({ status: "notFound" });

    mockStoredFile({
      bytes: new TextEncoder().encode("Notes"),
      contentType: "text/markdown",
      pathname: file,
      size: MAX_SOURCE_UPLOAD_BYTES + 1,
    });

    await expect(
      registerSourceUpload({ kind: "file", language: "pt", pathname: file }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expectNothingKept(user.id);
  });

  it("refuses a file type it can't read and a damaged PDF", async () => {
    const { pathname, user } = await signedIn();
    const video = pathname(`lecture-${randomUUID()}.mp4`);
    const pdf = pathname(`notice-${randomUUID()}.pdf`);

    mockStoredFile({ bytes: new Uint8Array([1, 2, 3]), contentType: "video/mp4", pathname: video });

    await expect(
      registerSourceUpload({ kind: "file", language: "pt", pathname: video }),
    ).resolves.toStrictEqual({ status: "unsupported" });

    mockStoredFile({
      bytes: new TextEncoder().encode("not really a PDF"),
      contentType: "application/pdf",
      pathname: pdf,
    });

    await expect(
      registerSourceUpload({ kind: "file", language: "pt", pathname: pdf }),
    ).resolves.toStrictEqual({ status: "unsupported" });

    await expectNothingKept(user.id);
  });

  it("says a link is missing when the page can't be fetched", async () => {
    const { user } = await signedIn();
    servePage(new Response("Gone", { status: 404 }));

    await expect(
      registerSourceUpload({ kind: "link", language: "pt", url: "https://example.com/gone" }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expectNothingKept(user.id);
  });

  it("refuses a link to something other than a page, PDF or text, and a page without text", async () => {
    const { user } = await signedIn();

    servePage(
      new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } }),
    );

    await expect(
      registerSourceUpload({ kind: "link", language: "pt", url: "https://example.com/chart.png" }),
    ).resolves.toStrictEqual({ status: "unsupported" });

    servePage(new Response("<div></div>", { headers: { "content-type": "text/html" } }));

    await expect(
      registerSourceUpload({ kind: "link", language: "pt", url: "https://example.com/empty" }),
    ).resolves.toStrictEqual({ status: "unsupported" });

    await expectNothingKept(user.id);
  });
});
