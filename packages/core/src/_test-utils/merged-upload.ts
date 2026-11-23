import { randomUUID } from "node:crypto";
import { type Source } from "@zoonk/db";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { Response as PageResponse, fetch } from "undici";
import { expect, vi } from "vitest";
import { hashDocument } from "../library/sources/parse-document";
import { shareSourceUpload } from "../library/sources/share-upload";

/** A learner's private upload of a notice another learner already shared. */
export async function uploadWithSharedCopyFixture(userId: string) {
  const text = `EDITAL Nº 1 – TJ-CE 2026. As provas serão aplicadas em 8 de julho. ${randomUUID()}`;
  const contentHash = hashDocument({ bytes: new Uint8Array(), text });

  const [upload, shared] = await Promise.all([
    sourceFixture({
      contentHash,
      extractedText: text,
      identityKey: `private:${userId}:upload:${contentHash}`,
      kind: "upload",
      language: "pt",
      mimeType: "text/plain",
      ownerId: userId,
      title: "edital.pdf",
      url: null,
      visibility: "private",
    }),
    sourceFixture({
      contentHash,
      extractedText: text,
      kind: "upload",
      language: "pt",
      title: "Edital nº 1 – TJ-CE 2026",
    }),
  ]);

  await learnerSourceFixture({ sourceId: upload.id, userId });

  return { shared, upload };
}

/** The visibility check finding the upload is the shared copy, through the real merge. */
export async function mergeIntoSharedCopy(upload: Pick<Source, "extractedText" | "id">) {
  vi.mocked(fetch).mockImplementation(
    async () =>
      new PageResponse(upload.extractedText, { headers: { "content-type": "text/markdown" } }),
  );

  const merged = await shareSourceUpload({
    language: "pt",
    publisher: "Cebraspe",
    sourceId: upload.id,
    title: "Edital nº 1 – TJ-CE 2026",
    url: "https://www.cebraspe.org.br/concursos/tj_ce_26/edital.md",
  });

  expect(merged).toMatchObject({ merged: true });
}
