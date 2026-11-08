import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { Response as PageResponse, fetch } from "undici";
import { describe, expect, it, vi } from "vitest";
import { loadSourceDocuments } from "./load-source-documents";
import { parseDocument } from "./parse-document";
import { PDF_CONTENT_TYPE, PPTX_CONTENT_TYPE } from "./source-contract";

async function webPdf(text: string) {
  return sourceFixture({ extractedText: text, mimeType: PDF_CONTENT_TYPE });
}

async function publishedPdf(text: string) {
  return sourceFixture({
    extractedText: text,
    mimeType: PDF_CONTENT_TYPE,
    url: `https://www.example.com/${randomUUID()}/edital.pdf`,
  });
}

describe(loadSourceDocuments, () => {
  it("passes a web PDF's bytes, since many model providers can't download the publisher's address", async () => {
    const bytes = new TextEncoder().encode(`%PDF-1.7 ${randomUUID()}`);

    vi.mocked(fetch).mockResolvedValue(
      new PageResponse(bytes, { headers: { "content-type": PDF_CONTENT_TYPE } }),
    );

    const source = await publishedPdf("Edital nº 1: 120 itens de certo ou errado.");
    const [document] = await loadSourceDocuments([source.id]);

    expect(document?.file).toStrictEqual({ data: bytes, mediaType: PDF_CONTENT_TYPE });
    expect(document?.text).toBe(source.extractedText);
  });

  it("passes a web PDF the publisher no longer serves as its stored text", async () => {
    vi.mocked(fetch).mockResolvedValue(new PageResponse("Not found", { status: 404 }));

    const source = await publishedPdf("Edital nº 1: 120 itens de certo ou errado.");
    const [document] = await loadSourceDocuments([source.id]);

    expect(document?.file).toBeNull();
    expect(document?.text).toBe(source.extractedText);
  });

  it("lets a failed download of a web PDF fail, so the step tries again", async () => {
    vi.mocked(fetch).mockResolvedValue(new PageResponse("Busy", { status: 503 }));

    const source = await publishedPdf("Edital");

    await expect(loadSourceDocuments([source.id])).rejects.toThrow(/status 503/u);
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

  it("reads a shared slide deck's pictures from the publisher's address", async () => {
    const slides = await readFile(new URL("_test-fixtures/class-slides.pptx", import.meta.url));

    vi.mocked(fetch).mockResolvedValue(
      new PageResponse(slides, { headers: { "content-type": PPTX_CONTENT_TYPE } }),
    );

    const source = await sourceFixture({
      kind: "upload",
      mimeType: PPTX_CONTENT_TYPE,
      url: `https://www.example.com/${randomUUID()}/slides.pptx`,
    });

    const [document] = await loadSourceDocuments([source.id]);

    expect(document?.images).toStrictEqual([{ data: expect.any(String), mediaType: "image/png" }]);
  });

  it("lets a failed download of a shared slide deck fail, so the step tries again", async () => {
    vi.mocked(fetch).mockResolvedValue(new PageResponse("Busy", { status: 503 }));

    const source = await sourceFixture({
      kind: "upload",
      mimeType: PPTX_CONTENT_TYPE,
      url: `https://www.example.com/${randomUUID()}/slides.pptx`,
    });

    await expect(loadSourceDocuments([source.id])).rejects.toThrow(/status 503/u);
  });

  it("loads sources in the order asked, skipping ones that no longer exist", async () => {
    const [first, second] = await Promise.all([webPdf("Edital"), webPdf("Retificação")]);

    const documents = await loadSourceDocuments([second.id, randomUUID(), first.id]);

    expect(documents.map((document) => document.id)).toStrictEqual([second.id, first.id]);
  });
});
