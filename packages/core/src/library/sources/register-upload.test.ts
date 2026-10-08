import { randomUUID } from "node:crypto";
import { del, get } from "@vercel/blob";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { registerSourceUpload } from "./register-upload";
import type * as RateLimitModule from "@zoonk/auth/rate-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

// Blob storage is an external service; tests serve the uploaded file from memory.
vi.mock("@vercel/blob", () => ({ del: vi.fn(), get: vi.fn() }));

/** The private store uploads live in. */
const PRIVATE_STORE = { storeId: "store_test", token: undefined };

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimitModule>()),
  isRateLimited: vi.fn(),
}));

const NOTICE_TEXT = "ENEM 2026: 180 questoes objetivas e uma redacao.";

function mockUploadedFile({
  bytes,
  contentType,
  pathname,
}: {
  bytes: Uint8Array;
  contentType: string;
  pathname: string;
}) {
  const url = `https://store.private.blob.vercel-storage.com/${pathname}`;

  // Each read gets its own stream, as each request to Blob storage would.
  vi.mocked(get).mockImplementation(async () => ({
    blob: {
      cacheControl: "",
      contentDisposition: "",
      contentType,
      downloadUrl: url,
      etag: "etag",
      pathname,
      size: bytes.byteLength,
      uploadedAt: new Date(),
      url,
    },
    headers: new Headers(),
    statusCode: 200,
    stream: new Response(new Uint8Array(bytes)).body!,
  }));

  return url;
}

/** A unique notice text, so tests that share the database never share a hash. */
function uniqueText() {
  return `${NOTICE_TEXT} ${randomUUID()}`;
}

function uploadNotice({ text, userId }: { text: string; userId: string }) {
  const pathname = `sources/${userId}/edital-${randomUUID()}.md`;
  const bytes = new TextEncoder().encode(text);

  return { pathname, url: mockUploadedFile({ bytes, contentType: "text/markdown", pathname }) };
}

describe(registerSourceUpload, () => {
  beforeEach(() => {
    mockSession(null);
    vi.mocked(isRateLimited).mockResolvedValue(false);
    vi.stubEnv("PRIVATE_BLOB_STORE_ID", PRIVATE_STORE.storeId);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires a signed-in learner", async () => {
    await expect(
      registerSourceUpload({ kind: "text", language: "pt", text: "Notas de aula" }),
    ).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("refuses a file outside the learner's own folder", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);
    mockSession(user.id);

    await expect(
      registerSourceUpload({
        kind: "file",
        language: "pt",
        pathname: `sources/${other.id}/notas.pdf`,
      }),
    ).resolves.toStrictEqual({ status: "invalidPathname" });

    expect(get).not.toHaveBeenCalled();
  });

  it("stores a new file as a private source of its owner and asks for a visibility check", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const text = uniqueText();
    const { pathname, url } = uploadNotice({ text, userId: user.id });

    const result = await registerSourceUpload({ kind: "file", language: "pt", pathname });

    expect(result).toMatchObject({ checkVisibility: true, status: "ready" });

    const source = await prisma.source.findFirstOrThrow({
      include: { learnerSources: true },
      where: { ownerId: user.id },
    });

    expect(source).toMatchObject({
      blobUrl: url,
      extractedText: text,
      kind: "upload",
      mimeType: "text/markdown",
      visibility: "private",
    });

    expect(source.title).toMatch(/^edital-/u);
    expect(source.identityKey).toBe(`private:${user.id}:upload:${source.contentHash}`);
    expect(source.learnerSources).toMatchObject([{ origin: "upload", userId: user.id }]);
    expect(del).not.toHaveBeenCalled();
  });

  it("reads a pasted link as the learner's own source, titled by its address", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const text = uniqueText();

    // The web is external: the page is served from memory.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(`<p>${text}</p>`, { headers: { "content-type": "text/html" } }),
      ),
    );

    const result = await registerSourceUpload({
      kind: "link",
      language: "pt",
      url: "https://www.example.com/aulas/glic%C3%B3lise#topo",
    });

    vi.unstubAllGlobals();

    expect(result).toMatchObject({ checkVisibility: true, status: "ready" });

    const source = await prisma.source.findFirstOrThrow({ where: { ownerId: user.id } });

    expect(source).toMatchObject({
      blobUrl: null,
      kind: "upload",
      mimeType: "text/html",
      title: "example.com/aulas/glicólise",
      url: "https://www.example.com/aulas/glic%C3%B3lise",
      visibility: "private",
    });

    expect(source.extractedText).toContain(text);
  });

  it("refuses links that aren't public web pages", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await expect(
      registerSourceUpload({ kind: "link", language: "pt", url: "http://localhost:3000/notes" }),
    ).resolves.toStrictEqual({ status: "unsupported" });
  });

  it("links a document already shared publicly instead of storing it again", async () => {
    const [user, uploader] = await Promise.all([userFixture(), userFixture()]);

    const text = uniqueText();

    mockSession(uploader.id);
    const first = uploadNotice({ text, userId: uploader.id });

    const created = await registerSourceUpload({
      kind: "file",
      language: "pt",
      pathname: first.pathname,
    });

    if (created.status !== "ready") {
      throw new Error("The first upload should be stored.");
    }

    await prisma.source.update({
      data: { ownerId: null, visibility: "public" },
      where: { id: created.source.id },
    });

    mockSession(user.id);
    const second = uploadNotice({ text, userId: user.id });

    const result = await registerSourceUpload({
      kind: "file",
      language: "en",
      pathname: second.pathname,
    });

    expect(result).toMatchObject({
      checkVisibility: false,
      source: { id: created.source.id },
      status: "ready",
    });

    expect(del).toHaveBeenCalledWith(second.url, PRIVATE_STORE);

    await expect(
      prisma.learnerSource.findMany({ where: { sourceId: created.source.id } }),
    ).resolves.toHaveLength(2);
  });

  it("never gives one learner another learner's private upload", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const text = uniqueText();

    mockSession(owner.id);
    const ownerResult = await registerSourceUpload({ kind: "text", language: "pt", text });

    mockSession(other.id);
    const otherResult = await registerSourceUpload({ kind: "text", language: "pt", text });

    expect(ownerResult).toMatchObject({ status: "ready" });
    expect(otherResult).toMatchObject({ checkVisibility: true, status: "ready" });

    if (ownerResult.status !== "ready" || otherResult.status !== "ready") {
      throw new Error("Both uploads should be stored.");
    }

    expect(otherResult.source.id).not.toBe(ownerResult.source.id);
    expect(otherResult.source.ownerId).toBe(other.id);
  });

  it("returns the learner's earlier copy when they upload the same text again", async () => {
    const user = await userFixture();
    const text = uniqueText();
    mockSession(user.id);

    const first = await registerSourceUpload({ kind: "text", language: "pt", text });

    const second = await registerSourceUpload({
      kind: "text",
      language: "pt",
      text: `  ${text}\n`,
    });

    expect(second).toMatchObject({ checkVisibility: false, status: "ready" });

    if (first.status !== "ready" || second.status !== "ready") {
      throw new Error("Both registrations should succeed.");
    }

    expect(second.source.id).toBe(first.source.id);
    await expect(prisma.learnerSource.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("keeps the file when the same registration is retried", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const { pathname } = uploadNotice({ text: uniqueText(), userId: user.id });

    const first = await registerSourceUpload({ kind: "file", language: "pt", pathname });
    const retry = await registerSourceUpload({ kind: "file", language: "pt", pathname });

    expect(retry).toMatchObject({ checkVisibility: false, status: "ready" });

    if (first.status !== "ready" || retry.status !== "ready") {
      throw new Error("Both registrations should succeed.");
    }

    expect(retry.source.id).toBe(first.source.id);
    expect(del).not.toHaveBeenCalled();
  });

  it("links the upload to the learner's goal but not to someone else's", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);

    const [ownGoal, otherGoal] = await Promise.all([
      goalFixture({ userId: user.id }),
      goalFixture({ userId: other.id }),
    ]);

    mockSession(user.id);

    await registerSourceUpload({
      goalId: ownGoal.id,
      kind: "text",
      language: "pt",
      text: uniqueText(),
    });

    await registerSourceUpload({
      goalId: otherGoal.id,
      kind: "text",
      language: "pt",
      text: uniqueText(),
    });

    const links = await prisma.learnerSource.findMany({
      orderBy: { createdAt: "asc" },
      where: { userId: user.id },
    });

    expect(links.map((link) => link.goalId)).toStrictEqual([ownGoal.id, null]);
  });

  it("stops at the plan's daily upload allowance and keeps no file", async () => {
    const user = await userFixture();
    await usageRecordsFixture({ count: 3, kind: "upload", userId: user.id });
    mockSession(user.id);

    const { pathname, url } = uploadNotice({ text: uniqueText(), userId: user.id });

    await expect(
      registerSourceUpload({ kind: "file", language: "pt", pathname }),
    ).resolves.toMatchObject({
      limit: { limit: 3, period: "day", resource: "upload" },
      status: "limitReached",
    });

    expect(del).toHaveBeenCalledWith(url, PRIVATE_STORE);
    await expect(prisma.source.count({ where: { ownerId: user.id } })).resolves.toBe(0);
  });

  it("doesn't let guests upload", async () => {
    const guest = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });
    mockGuestSession(guest.id);

    await expect(
      registerSourceUpload({ kind: "text", language: "pt", text: uniqueText() }),
    ).resolves.toMatchObject({ status: "limitReached" });
  });

  it("counts an upload once, so registering the same text again is free", async () => {
    const user = await userFixture();
    const text = uniqueText();
    await usageRecordsFixture({ count: 2, kind: "upload", userId: user.id });
    mockSession(user.id);

    await expect(
      registerSourceUpload({ kind: "text", language: "pt", text }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(
      registerSourceUpload({ kind: "text", language: "pt", text }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(
      prisma.usageRecord.count({ where: { kind: "upload", userId: user.id } }),
    ).resolves.toBe(3);
  });

  it("refuses empty text and files it can't read", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await expect(
      registerSourceUpload({ kind: "text", language: "pt", text: "   " }),
    ).resolves.toStrictEqual({ status: "unsupported" });

    const pathname = `sources/${user.id}/archive.zip`;

    mockUploadedFile({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "application/zip",
      pathname,
    });

    await expect(
      registerSourceUpload({ kind: "file", language: "pt", pathname }),
    ).resolves.toStrictEqual({ status: "unsupported" });
  });

  it("reports a file that was never uploaded", async () => {
    const user = await userFixture();
    mockSession(user.id);
    vi.mocked(get).mockResolvedValue(null);

    await expect(
      registerSourceUpload({
        kind: "file",
        language: "pt",
        pathname: `sources/${user.id}/missing.pdf`,
      }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
