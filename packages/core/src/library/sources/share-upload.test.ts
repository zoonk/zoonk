import { randomUUID } from "node:crypto";
import { del } from "@vercel/blob";
import { prisma } from "@zoonk/db";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { Response as PageResponse, fetch } from "undici";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashDocument } from "./parse-document";
import { shareSourceUpload } from "./share-upload";

const PRIVATE_STORE = { storeId: "store_test", token: undefined };

const NOTICE_URL = "https://www.cebraspe.org.br/concursos/tj_ce_26/edital.md";

function noticeText() {
  return `EDITAL Nº 1 – TJ-CE 2026. As provas serão aplicadas em 8 de julho. ${randomUUID()}`;
}

function servePublisherCopy(text: string) {
  vi.mocked(fetch).mockImplementation(
    async () => new PageResponse(text, { headers: { "content-type": "text/markdown" } }),
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

  it("ignores sources that aren't private uploads", async () => {
    const source = await sourceFixture();

    await expect(shareNotice(source.id)).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
