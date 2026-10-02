import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { hashDocument, isCutText, parseDocument } from "./parse-document";
import {
  DOCX_CONTENT_TYPE,
  PAGE_BREAK,
  PDF_CONTENT_TYPE,
  PPTX_CONTENT_TYPE,
} from "./source-contract";

function readFixture(name: string) {
  return readFile(new URL(`_test-fixtures/${name}`, import.meta.url));
}

describe(parseDocument, () => {
  it("reads a Word file as text", async () => {
    const parsed = await parseDocument({
      bytes: await readFixture("notice.docx"),
      contentType: DOCX_CONTENT_TYPE,
    });

    expect(parsed.text).toContain("A prova objetiva tera 120 questoes de certo ou errado.");
    expect(parsed.images).toStrictEqual([]);
  });

  it("reads a PowerPoint file as text and the images models can read", async () => {
    const parsed = await parseDocument({
      bytes: await readFixture("class-slides.pptx"),
      contentType: PPTX_CONTENT_TYPE,
    });

    expect(parsed.text).toContain("Enzimas: cinetica de Michaelis-Menten");
    expect(parsed.pages).toBe(1);
    expect(parsed.images).toStrictEqual([{ data: expect.any(String), mediaType: "image/png" }]);
  });

  it("extracts a PDF's text for search and citation checks", async () => {
    const parsed = await parseDocument({
      bytes: await readFixture("notice.pdf"),
      contentType: PDF_CONTENT_TYPE,
    });

    expect(parsed.text).toBe("ENEM 2026: 180 questoes objetivas e uma redacao.");
    expect(parsed.pages).toBe(1);
  });

  it("keeps each slide's text on its own page, empty slides included", async () => {
    const parsed = await parseDocument({
      bytes: await readFixture("lecture-slides.pptx"),
      contentType: PPTX_CONTENT_TYPE,
    });

    expect(parsed.pages).toBe(3);

    expect(parsed.text?.split(PAGE_BREAK)).toStrictEqual([
      "Glycolysis",
      "",
      "Net yield\n2 ATP per glucose",
    ]);
  });

  it("keeps each PDF page's text on its own page", async () => {
    const parsed = await parseDocument({
      bytes: await readFixture("two-pages.pdf"),
      contentType: PDF_CONTENT_TYPE,
    });

    expect(parsed.pages).toBe(2);

    expect(parsed.text?.split(PAGE_BREAK)).toStrictEqual([
      "Page one: enzymes lower activation energy.",
      "Page two: glycolysis yields 2 ATP.",
    ]);
  });

  it("reads Markdown as UTF-8 text even with a charset parameter", async () => {
    const parsed = await parseDocument({
      bytes: await readFixture("notes.md"),
      contentType: "text/markdown; charset=utf-8",
    });

    expect(parsed.text).toBe(
      "# Biochemistry notes\n\nEnzymes lower the activation energy of a reaction.",
    );
  });

  it("keeps images as files without text", async () => {
    const parsed = await parseDocument({
      bytes: await readFixture("diagram.png"),
      contentType: "image/png",
    });

    expect(parsed).toStrictEqual({ images: [], pages: null, text: null });
  });

  it("keeps the start of a text too long for a row, and knows it's cut", async () => {
    const long = `  ${"Edital ".repeat(80_000)}`;
    const parsed = await parseDocument({ bytes: Buffer.from(long), contentType: "text/plain" });

    expect(parsed.text?.startsWith("Edital")).toBe(true);
    expect(isCutText(parsed.text)).toBe(true);
    expect(isCutText("Edital")).toBe(false);
    expect(isCutText(null)).toBe(false);
  });

  it("rejects types it can't read", async () => {
    await expect(
      parseDocument({ bytes: new Uint8Array([1, 2]), contentType: "application/zip" }),
    ).rejects.toThrow("Unsupported document type: application/zip");
  });
});

describe(hashDocument, () => {
  it("identifies a document with text by its text, so a re-rendered page isn't a change", async () => {
    const bytes = await readFixture("notice.pdf");

    expect(hashDocument({ bytes, text: "Edital" })).toBe(
      hashDocument({ bytes: new Uint8Array([1, 2, 3]), text: "Edital" }),
    );
  });

  it("identifies a document without text by its bytes", async () => {
    const bytes = await readFixture("diagram.png");

    expect(hashDocument({ bytes, text: null })).toBe(
      hashDocument({ bytes: new Uint8Array(bytes), text: null }),
    );

    expect(hashDocument({ bytes, text: null })).not.toBe(
      hashDocument({ bytes: new Uint8Array([1]), text: null }),
    );

    expect(hashDocument({ bytes, text: null })).toMatch(/^[a-f0-9]{64}$/u);
  });
});
