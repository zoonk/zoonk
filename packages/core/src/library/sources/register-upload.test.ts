import { randomUUID } from "node:crypto";
import { del, get, issueSignedToken } from "@vercel/blob";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { Response as PageResponse, fetch } from "undici";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { createSourceUploadToken } from "./create-upload-token";
import { hashDocument } from "./parse-document";
import { registerSourceUpload } from "./register-upload";
import { shareSourceUpload } from "./share-upload";
import { refreshWebSource } from "./web-sources";

const PRIVATE_STORE = { storeId: "store_test", token: undefined };

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

function serveLinkedPage() {
  vi.mocked(fetch).mockResolvedValue(
    new PageResponse(`<p>${uniqueText()}</p>`, { headers: { "content-type": "text/html" } }),
  );
}

function uniqueText() {
  return `${NOTICE_TEXT} ${randomUUID()}`;
}

function servePublisherCopy(text: string) {
  vi.mocked(fetch).mockImplementation(
    async () => new PageResponse(text, { headers: { "content-type": "text/plain" } }),
  );
}

function shareNotice(sourceId: string) {
  return shareSourceUpload({
    language: "pt",
    publisher: null,
    sourceId,
    title: "Edital",
    url: "https://www.example.com/edital.txt",
  });
}

function uploadNotice({ text, userId }: { text: string; userId: string }) {
  const pathname = `sources/${userId}/${randomUUID()}-edital.md`;
  const bytes = new TextEncoder().encode(text);

  return { pathname, url: mockUploadedFile({ bytes, contentType: "text/markdown", pathname }) };
}

describe(registerSourceUpload, () => {
  beforeEach(() => {
    mockSession(null);
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

  it("stores a new file as a private source of its owner, titled by its name, and asks for a visibility check", async () => {
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

    expect(source.title).toBe("edital");
    expect(source.identityKey).toBe(`private:${user.id}:upload:${source.contentHash}`);
    expect(source.learnerSources).toMatchObject([{ origin: "upload", userId: user.id }]);
    expect(del).not.toHaveBeenCalled();
  });

  it("reads a pasted link as the learner's own source, titled by its address", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const text = uniqueText();

    vi.mocked(fetch).mockResolvedValue(
      new PageResponse(`<p>${text}</p>`, { headers: { "content-type": "text/html" } }),
    );

    const result = await registerSourceUpload({
      kind: "link",
      language: "pt",
      url: "https://www.example.com/aulas/glic%C3%B3lise#topo",
    });

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

  it("asks for one visibility check when the same file is registered twice at once", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const { pathname } = uploadNotice({ text: uniqueText(), userId: user.id });
    const bothReading = Promise.withResolvers<null>();
    const readBlob = vi.mocked(get).getMockImplementation();

    vi.mocked(get).mockImplementation(async (...args) => {
      if (vi.mocked(get).mock.calls.length === 2) {
        bothReading.resolve(null);
      }

      await bothReading.promise;
      return readBlob?.(...args) ?? null;
    });

    const results = await Promise.all([
      registerSourceUpload({ kind: "file", language: "pt", pathname }),
      registerSourceUpload({ kind: "file", language: "pt", pathname }),
    ]);

    expect(
      results.filter((result) => result.status === "ready" && result.checkVisibility),
    ).toHaveLength(1);

    const source = await prisma.source.findFirstOrThrow({ where: { ownerId: user.id } });

    await expect(
      prisma.followUp.findMany({ select: { input: true, kind: true }, where: { userId: user.id } }),
    ).resolves.toStrictEqual([{ input: { sourceId: source.id }, kind: "checkUploadVisibility" }]);
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

  it("answers a retried file registration after sharing removed its file", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const { pathname } = uploadNotice({ text: uniqueText(), userId: user.id });

    const first = await registerSourceUpload({ kind: "file", language: "pt", pathname });

    if (first.status !== "ready") {
      throw new Error("The first registration should succeed.");
    }

    await prisma.source.update({
      data: { blobUrl: null, ownerId: null, visibility: "public" },
      where: { id: first.source.id },
    });

    vi.mocked(get).mockResolvedValue(null);

    await expect(
      registerSourceUpload({ kind: "file", language: "pt", pathname }),
    ).resolves.toMatchObject({
      checkVisibility: false,
      source: { id: first.source.id },
      status: "ready",
    });
  });

  it("answers a retried file registration after its file matched a stored copy", async () => {
    const user = await userFixture();
    const text = uniqueText();

    const shared = await sourceFixture({
      contentHash: hashDocument({ bytes: new TextEncoder().encode(text), text }),
    });

    mockSession(user.id);
    const { pathname } = uploadNotice({ text, userId: user.id });

    await registerSourceUpload({ kind: "file", language: "pt", pathname });
    vi.mocked(get).mockResolvedValue(null);

    await expect(
      registerSourceUpload({ kind: "file", language: "pt", pathname }),
    ).resolves.toMatchObject({
      checkVisibility: false,
      source: { id: shared.id },
      status: "ready",
    });
  });

  it("answers a retried file registration after sharing merged it into another copy", async () => {
    const user = await userFixture();
    const text = uniqueText();
    mockSession(user.id);
    const { pathname } = uploadNotice({ text, userId: user.id });

    const first = await registerSourceUpload({ kind: "file", language: "pt", pathname });

    if (first.status !== "ready") {
      throw new Error("The first registration should succeed.");
    }

    const shared = await sourceFixture({ contentHash: first.source.contentHash });

    vi.mocked(fetch).mockResolvedValue(
      new PageResponse(text, { headers: { "content-type": "text/markdown" } }),
    );

    await expect(
      shareSourceUpload({
        language: "pt",
        publisher: null,
        sourceId: first.source.id,
        title: "Edital",
        url: "https://www.example.com/edital.md",
      }),
    ).resolves.toStrictEqual({ merged: true, sourceId: shared.id });

    vi.mocked(get).mockResolvedValue(null);

    await expect(
      registerSourceUpload({ kind: "file", language: "pt", pathname }),
    ).resolves.toMatchObject({
      checkVisibility: false,
      source: { id: shared.id },
      status: "ready",
    });
  });

  it("records an upload of a document research had already linked as the learner's own", async () => {
    const user = await userFixture();
    const text = uniqueText();

    const shared = await sourceFixture({
      contentHash: hashDocument({ bytes: new TextEncoder().encode(text), text }),
    });

    await learnerSourceFixture({ origin: "research", sourceId: shared.id, userId: user.id });
    mockSession(user.id);

    await expect(
      registerSourceUpload({ kind: "text", language: "pt", text }),
    ).resolves.toMatchObject({ source: { id: shared.id }, status: "ready" });

    await expect(
      prisma.learnerSource.findMany({ select: { origin: true }, where: { userId: user.id } }),
    ).resolves.toStrictEqual([{ origin: "upload" }]);
  });

  it("charges one upload when the same link is registered twice at once", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const page = `<p>${uniqueText()}</p>`;
    const bothFetching = Promise.withResolvers<null>();

    vi.mocked(fetch).mockImplementation(async () => {
      if (vi.mocked(fetch).mock.calls.length === 2) {
        bothFetching.resolve(null);
      }

      await bothFetching.promise;
      return new PageResponse(page, { headers: { "content-type": "text/html" } });
    });

    const link = { kind: "link", language: "pt", url: "https://www.example.com/edital" } as const;
    await Promise.all([registerSourceUpload(link), registerSourceUpload(link)]);

    await expect(
      prisma.usageRecord.count({ where: { kind: "upload", userId: user.id } }),
    ).resolves.toBe(1);

    await expect(prisma.source.count({ where: { ownerId: user.id } })).resolves.toBe(1);
  });

  it("charges nothing more for pasted text sent again after sharing merged it into another copy", async () => {
    const [first, second] = await Promise.all([userFixture(), userFixture()]);
    const text = uniqueText();
    servePublisherCopy(text);

    mockSession(first.id);
    const shared = await registerSourceUpload({ kind: "text", language: "pt", text });
    mockSession(second.id);
    const merged = await registerSourceUpload({ kind: "text", language: "pt", text });

    if (shared.status !== "ready" || merged.status !== "ready") {
      throw new Error("Both uploads should be stored.");
    }

    await shareNotice(shared.source.id);

    await expect(shareNotice(merged.source.id)).resolves.toStrictEqual({
      merged: true,
      sourceId: shared.source.id,
    });

    await expect(
      registerSourceUpload({ kind: "text", language: "pt", text }),
    ).resolves.toMatchObject({ source: { id: shared.source.id }, status: "ready" });

    await expect(
      prisma.usageRecord.count({ where: { kind: "upload", userId: second.id } }),
    ).resolves.toBe(1);
  });

  it("stores pasted text again after the shared copy it became was updated", async () => {
    const user = await userFixture();
    const text = uniqueText();
    servePublisherCopy(text);
    mockSession(user.id);

    const first = await registerSourceUpload({ kind: "text", language: "pt", text });

    if (first.status !== "ready") {
      throw new Error("The first upload should be stored.");
    }

    await shareNotice(first.source.id);
    servePublisherCopy(uniqueText());
    await expect(refreshWebSource(first.source.id)).resolves.toMatchObject({ status: "changed" });

    const again = await registerSourceUpload({ kind: "text", language: "pt", text });

    expect(again).toMatchObject({
      checkVisibility: true,
      source: { ownerId: user.id, visibility: "private" },
      status: "ready",
    });

    await expect(
      prisma.usageRecord.count({ where: { kind: "upload", userId: user.id } }),
    ).resolves.toBe(1);
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

  it("doesn't download a link once the learner has no uploads left", async () => {
    const user = await userFixture();
    await usageRecordsFixture({ count: 3, kind: "upload", userId: user.id });
    mockSession(user.id);
    serveLinkedPage();

    await expect(
      registerSourceUpload({ kind: "link", language: "pt", url: "https://www.example.com/edital" }),
    ).resolves.toMatchObject({ limit: { resource: "upload" }, status: "limitReached" });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("doesn't download a guest's link", async () => {
    const guest = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });
    mockGuestSession(guest.id);
    serveLinkedPage();

    await expect(
      registerSourceUpload({ kind: "link", language: "pt", url: "https://www.example.com/edital" }),
    ).resolves.toMatchObject({ status: "limitReached" });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("doesn't download a link while a Plus learner's uploads are spaced out", async () => {
    const user = await userFixture();

    await Promise.all([
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
      usageRecordsFixture({ count: 30, kind: "upload", userId: user.id }),
    ]);

    mockSession(user.id);
    serveLinkedPage();

    await expect(
      registerSourceUpload({ kind: "link", language: "pt", url: "https://www.example.com/edital" }),
    ).resolves.toMatchObject({ status: "slowDown" });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("counts a file once: signing its upload, registering it and pasting the same text", async () => {
    const user = await userFixture();
    await usageRecordsFixture({ count: 2, kind: "upload", userId: user.id });
    mockSession(user.id);

    vi.mocked(issueSignedToken).mockResolvedValue({
      clientSigningToken: "client-signing-token",
      delegationToken: "delegation-token",
      validUntil: Date.now(),
    });

    const text = uniqueText();
    const { pathname } = uploadNotice({ text, userId: user.id });

    const countUploads = () =>
      prisma.usageRecord.count({ where: { kind: "upload", userId: user.id } });

    await expect(createSourceUploadToken({ pathname })).resolves.toMatchObject({ status: "ready" });
    await expect(countUploads()).resolves.toBe(3);

    await expect(
      registerSourceUpload({ kind: "file", language: "pt", pathname }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(
      registerSourceUpload({ kind: "text", language: "pt", text }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(countUploads()).resolves.toBe(3);
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
});
