import { randomUUID } from "node:crypto";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";

export function privateUploadFixture({
  ownerId,
  text = "Edital nº 1: a prova terá 120 questões.",
}: {
  ownerId: string;
  text?: string;
}) {
  const contentHash = `hash-${randomUUID()}`;

  return sourceFixture({
    contentHash,
    extractedText: text,
    identityKey: `private:${ownerId}:upload:${contentHash}`,
    kind: "upload",
    mimeType: "text/plain",
    ownerId,
    title: "My notes",
    url: null,
    visibility: "private",
  });
}
