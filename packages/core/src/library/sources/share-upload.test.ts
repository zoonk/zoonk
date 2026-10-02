import { randomUUID } from "node:crypto";
import { del } from "@vercel/blob";
import { prisma } from "@zoonk/db";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shareSourceUpload } from "./share-upload";

// Blob storage is an external service; only the removal of a duplicate file is observed.
vi.mock("@vercel/blob", () => ({ del: vi.fn(), get: vi.fn() }));

/** The private store uploads live in. */
const PRIVATE_STORE = { storeId: "store_test", token: undefined };

async function privateUploadFixture({
  contentHash,
  userId,
}: {
  contentHash: string;
  userId: string;
}) {
  const source = await sourceFixture({
    blobUrl: `https://store.private.blob.vercel-storage.com/sources/${userId}/${randomUUID()}.pdf`,
    contentHash,
    identityKey: `private:${userId}:upload:${contentHash}`,
    kind: "upload",
    language: "pt",
    ownerId: userId,
    title: "edital",
    url: null,
    visibility: "private",
  });

  await learnerSourceFixture({ sourceId: source.id, userId });

  return source;
}

describe(shareSourceUpload, () => {
  beforeEach(() => {
    vi.stubEnv("PRIVATE_BLOB_STORE_ID", PRIVATE_STORE.storeId);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("makes a confirmed public document shared and no longer owned by its uploader", async () => {
    const user = await userFixture();

    const source = await privateUploadFixture({
      contentHash: `hash-${randomUUID()}`,
      userId: user.id,
    });

    const result = await shareSourceUpload({
      language: "pt",
      publisher: "Cebraspe",
      sourceId: source.id,
      title: "Edital nº 1 – TJ-CE 2026",
      url: "https://www.cebraspe.org.br/concursos/tj_ce_26/edital.pdf",
    });

    expect(result).toStrictEqual({ merged: false, sourceId: source.id });

    const shared = await prisma.source.findUniqueOrThrow({ where: { id: source.id } });

    expect(shared).toMatchObject({
      identityKey: `upload:${source.contentHash}`,
      ownerId: null,
      publisher: "Cebraspe",
      title: "Edital nº 1 – TJ-CE 2026",
      visibility: "public",
    });

    expect(shared.reusePolicy).toMatchObject({ pastQuestions: "allowedWithCitation" });

    // Deleting the uploader keeps the shared document for everyone else.
    await prisma.user.delete({ where: { id: user.id } });
    await expect(prisma.source.findUnique({ where: { id: source.id } })).resolves.not.toBeNull();
  });

  it("merges into the copy another learner shared first and removes the duplicate file", async () => {
    const [first, second, both] = await Promise.all([userFixture(), userFixture(), userFixture()]);
    const contentHash = `hash-${randomUUID()}`;

    const shared = await privateUploadFixture({ contentHash, userId: first.id });

    await shareSourceUpload({
      language: "pt",
      publisher: null,
      sourceId: shared.id,
      title: "Edital",
      url: null,
    });

    const duplicate = await privateUploadFixture({ contentHash, userId: second.id });
    await learnerSourceFixture({ sourceId: duplicate.id, userId: both.id });
    await learnerSourceFixture({ sourceId: shared.id, userId: both.id });

    const result = await shareSourceUpload({
      language: "pt",
      publisher: null,
      sourceId: duplicate.id,
      title: "Edital",
      url: null,
    });

    expect(result).toStrictEqual({ merged: true, sourceId: shared.id });
    expect(del).toHaveBeenCalledWith(duplicate.blobUrl, PRIVATE_STORE);

    await expect(prisma.source.findUnique({ where: { id: duplicate.id } })).resolves.toBeNull();

    const links = await prisma.learnerSource.findMany({ where: { sourceId: shared.id } });

    expect(links.map((link) => link.userId).toSorted()).toStrictEqual(
      [first.id, second.id, both.id].toSorted(),
    );
  });

  it("ignores sources that aren't private uploads", async () => {
    const source = await sourceFixture();

    await expect(
      shareSourceUpload({
        language: "en",
        publisher: null,
        sourceId: source.id,
        title: "x",
        url: null,
      }),
    ).resolves.toBeNull();
  });
});
