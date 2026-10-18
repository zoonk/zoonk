import { randomUUID } from "node:crypto";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it } from "vitest";
import { loadSourceDocuments } from "./load-source-documents";
import { parseDocument } from "./parse-document";
import { PDF_CONTENT_TYPE } from "./source-contract";

async function webPdf(text: string) {
  return sourceFixture({ extractedText: text, mimeType: PDF_CONTENT_TYPE });
}

describe(loadSourceDocuments, () => {
  it("passes a web PDF by its address, with its text for the citation checks", async () => {
    const source = await webPdf("Edital nº 1: 120 itens de certo ou errado.");
    const [document] = await loadSourceDocuments([source.id]);

    expect(document?.file).toStrictEqual({
      data: new URL(source.url ?? ""),
      mediaType: PDF_CONTENT_TYPE,
    });

    expect(document?.text).toBe(source.extractedText);
  });

  it("passes a PDF whose stored text was cut as that text, so every quote can be checked", async () => {
    const long = await parseDocument({
      bytes: Buffer.from("Framework ".repeat(60_000)),
      contentType: "text/plain",
    });

    const source = await webPdf(long.text ?? "");
    const [document] = await loadSourceDocuments([source.id]);

    expect(document?.file).toBeNull();
    expect(document?.text).toBe(long.text);
  });

  it("loads sources in the order asked, skipping ones that no longer exist", async () => {
    const [first, second] = await Promise.all([webPdf("Edital"), webPdf("Retificação")]);

    const documents = await loadSourceDocuments([second.id, randomUUID(), first.id]);

    expect(documents.map((document) => document.id)).toStrictEqual([second.id, first.id]);
  });
});
