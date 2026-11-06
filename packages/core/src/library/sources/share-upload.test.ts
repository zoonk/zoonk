import { randomUUID } from "node:crypto";
import { del, get } from "@vercel/blob";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { Response as PageResponse, fetch } from "undici";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSourceDocuments } from "./load-source-documents";
import { hashDocument } from "./parse-document";
import { shareSourceUpload } from "./share-upload";
import { refreshWebSource } from "./web-sources";

const PRIVATE_STORE = { storeId: "store_test" };

const NOTICE_URL = "https://www.cebraspe.org.br/concursos/tj_ce_26/edital.md";

function noticeText() {
  return `EDITAL Nº 1 – TJ-CE 2026. As provas serão aplicadas em 8 de julho. ${randomUUID()}`;
}

function servePublisherCopy(text: string) {
  vi.mocked(fetch).mockImplementation(
    async () => new PageResponse(text, { headers: { "content-type": "text/markdown" } }),
  );
}

function servePublisherImage(bytes: Uint8Array) {
  vi.mocked(fetch).mockImplementation(
    async () => new PageResponse(bytes, { headers: { "content-type": "image/png" } }),
  );
}

async function privateUploadFixture({ text, userId }: { text: string; userId: string }) {
  const contentHash = hashDocument({ bytes: new Uint8Array(), text });

  const source = await sourceFixture({
    blobUrl: `https://store.private.blob.vercel-storage.com/sources/${userId}/${randomUUID()}.pdf`,
    contentHash,
    extractedText: text,
    identityKey: `private:${userId}:upload:${contentHash}`,
    kind: "upload",
    language: "pt",
    mimeType: "application/pdf",
    ownerId: userId,
    title: "edital",
    url: null,
    visibility: "private",
  });

  await learnerSourceFixture({ sourceId: source.id, userId });

  return source;
}

function shareNotice(sourceId: string) {
  return shareSourceUpload({
    language: "pt",
    publisher: "Cebraspe",
    sourceId,
    title: "Edital nº 1 – TJ-CE 2026",
    url: NOTICE_URL,
  });
}

describe(shareSourceUpload, () => {
  beforeEach(() => {
    vi.stubEnv("PRIVATE_BLOB_STORE_ID", PRIVATE_STORE.storeId);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shares a confirmed upload as the publisher's copy, keeping nothing of the learner's file", async () => {
    const user = await userFixture();
    const text = noticeText();
    const source = await privateUploadFixture({ text, userId: user.id });
    servePublisherCopy(text);

    await expect(shareNotice(source.id)).resolves.toStrictEqual({
      merged: false,
      sourceId: source.id,
    });

    const shared = await prisma.source.findUniqueOrThrow({ where: { id: source.id } });

    expect(shared).toMatchObject({
      blobUrl: null,
      extractedText: text,
      identityKey: `upload:${source.contentHash}`,
      mimeType: "text/markdown",
      ownerId: null,
      publisher: "Cebraspe",
      title: "Edital nº 1 – TJ-CE 2026",
      url: NOTICE_URL,
      visibility: "public",
    });

    expect(shared.reusePolicy).toMatchObject({ pastQuestions: "allowedWithCitation" });
    expect(del).toHaveBeenCalledWith(source.blobUrl, PRIVATE_STORE);

    await prisma.user.delete({ where: { id: user.id } });
    await expect(prisma.source.findUnique({ where: { id: source.id } })).resolves.not.toBeNull();
  });

  it("keeps an upload private when the publisher's copy reads differently", async () => {
    const user = await userFixture();
    const notice = noticeText().repeat(150);

    const source = await privateUploadFixture({
      text: `${notice}\n\nMinhas notas: CPF 123.456.789-00, nota 6,5 em português.`,
      userId: user.id,
    });

    servePublisherCopy(notice);

    await expect(shareNotice(source.id)).resolves.toBeNull();

    await expect(
      prisma.source.findUniqueOrThrow({ where: { id: source.id } }),
    ).resolves.toMatchObject({ blobUrl: source.blobUrl, ownerId: user.id, visibility: "private" });

    expect(del).not.toHaveBeenCalled();
  });

  it("reads a shared image from the publisher's address, so research reads it as updated there", async () => {
    const user = await userFixture();
    const learnerBytes = new TextEncoder().encode(`PNG ${randomUUID()}`);
    const contentHash = hashDocument({ bytes: learnerBytes, text: null });
    const blobUrl = `https://store.private.blob.vercel-storage.com/sources/${user.id}/${randomUUID()}.png`;

    const source = await sourceFixture({
      blobUrl,
      contentHash,
      extractedText: null,
      identityKey: `private:${user.id}:upload:${contentHash}`,
      kind: "upload",
      language: "pt",
      mimeType: "image/png",
      ownerId: user.id,
      url: null,
      visibility: "private",
    });

    vi.mocked(get).mockImplementation(async () => ({
      blob: {
        cacheControl: "",
        contentDisposition: "",
        contentType: "image/png",
        downloadUrl: blobUrl,
        etag: "etag",
        pathname: blobUrl,
        size: learnerBytes.byteLength,
        uploadedAt: new Date(),
        url: blobUrl,
      },
      headers: new Headers(),
      statusCode: 200,
      stream: new Response(learnerBytes).body!,
    }));

    servePublisherImage(learnerBytes);
    await expect(shareNotice(source.id)).resolves.toMatchObject({ merged: false });

    servePublisherImage(new TextEncoder().encode(`PNG ${randomUUID()}`));
    const refresh = await refreshWebSource(source.id);
    const [document] = await loadSourceDocuments([source.id]);

    expect(document?.contentHash).toBe(refresh?.source.contentHash);
    expect(document?.file).toStrictEqual({ data: new URL(NOTICE_URL), mediaType: "image/png" });

    expect(del).toHaveBeenCalledWith(blobUrl, PRIVATE_STORE);
  });

  it("merges into the copy another learner shared first and removes the duplicate file", async () => {
    const [first, second, both] = await Promise.all([userFixture(), userFixture(), userFixture()]);
    const text = noticeText();
    servePublisherCopy(text);

    const shared = await privateUploadFixture({ text, userId: first.id });
    await shareNotice(shared.id);

    const duplicate = await privateUploadFixture({ text, userId: second.id });
    await learnerSourceFixture({ sourceId: duplicate.id, userId: both.id });
    await learnerSourceFixture({ sourceId: shared.id, userId: both.id });

    await expect(shareNotice(duplicate.id)).resolves.toStrictEqual({
      merged: true,
      sourceId: shared.id,
    });

    expect(del).toHaveBeenCalledWith(duplicate.blobUrl, PRIVATE_STORE);

    await expect(prisma.source.findUnique({ where: { id: duplicate.id } })).resolves.toBeNull();

    const links = await prisma.learnerSource.findMany({ where: { sourceId: shared.id } });

    expect(links.map((link) => link.userId).toSorted()).toStrictEqual(
      [first.id, second.id, both.id].toSorted(),
    );
  });

  it("moves what lessons read from the duplicate to the shared copy at the version they read", async () => {
    const [first, second] = await Promise.all([userFixture(), userFixture()]);
    const text = noticeText();
    servePublisherCopy(text);

    const shared = await privateUploadFixture({ text, userId: first.id });
    await shareNotice(shared.id);

    const duplicate = await privateUploadFixture({ text, userId: second.id });
    const lesson = await libraryLessonFixture({ ownerId: second.id, visibility: "private" });

    const [readOne, readBoth] = await Promise.all([
      libraryStepFixture({ lessonId: lesson.id, position: 0 }),
      libraryStepFixture({ lessonId: lesson.id, position: 1 }),
    ]);

    await prisma.stepSource.createMany({
      data: [
        { contentHash: "version-read", sourceId: duplicate.id, stepId: readOne.id },
        { contentHash: duplicate.contentHash, sourceId: duplicate.id, stepId: readBoth.id },
        { contentHash: shared.contentHash, sourceId: shared.id, stepId: readBoth.id },
      ],
    });

    await expect(shareNotice(duplicate.id)).resolves.toMatchObject({ merged: true });

    const reads = await prisma.stepSource.findMany({
      select: { contentHash: true, sourceId: true, stepId: true },
      where: { step: { lessonId: lesson.id } },
    });

    expect(reads).toHaveLength(2);

    expect(reads).toStrictEqual(
      expect.arrayContaining([
        { contentHash: "version-read", sourceId: shared.id, stepId: readOne.id },
        { contentHash: shared.contentHash, sourceId: shared.id, stepId: readBoth.id },
      ]),
    );
  });

  it("keeps an upload private when the copy first shared with its text moved to a newer edition", async () => {
    const [first, second] = await Promise.all([userFixture(), userFixture()]);
    const text = noticeText();
    servePublisherCopy(text);

    const shared = await privateUploadFixture({ text, userId: first.id });
    await shareNotice(shared.id);
    servePublisherCopy(noticeText());
    await expect(refreshWebSource(shared.id)).resolves.toMatchObject({ status: "changed" });

    servePublisherCopy(text);
    const late = await privateUploadFixture({ text, userId: second.id });
    vi.mocked(del).mockClear();

    await expect(shareNotice(late.id)).resolves.toBeNull();

    await expect(
      prisma.source.findUniqueOrThrow({ where: { id: late.id } }),
    ).resolves.toMatchObject({ blobUrl: late.blobUrl, extractedText: text, visibility: "private" });

    expect(del).not.toHaveBeenCalled();
  });

  it("keeps a learner's upload and the ask it answered when they already followed the shared copy", async () => {
    const [first, learner] = await Promise.all([userFixture(), userFixture()]);
    const text = noticeText();
    servePublisherCopy(text);

    const shared = await privateUploadFixture({ text, userId: first.id });
    await shareNotice(shared.id);
    await learnerSourceFixture({ origin: "research", sourceId: shared.id, userId: learner.id });

    const upload = await privateUploadFixture({ text, userId: learner.id });
    const answeredAt = new Date();
    await prisma.learnerSource.updateMany({ data: { answeredAt }, where: { sourceId: upload.id } });

    await expect(shareNotice(upload.id)).resolves.toMatchObject({ merged: true });

    await expect(
      prisma.learnerSource.findMany({
        select: { answeredAt: true, origin: true, sourceId: true },
        where: { userId: learner.id },
      }),
    ).resolves.toStrictEqual([{ answeredAt, origin: "upload", sourceId: shared.id }]);
  });

  it("ignores sources that aren't private uploads", async () => {
    const source = await sourceFixture();

    await expect(shareNotice(source.id)).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
