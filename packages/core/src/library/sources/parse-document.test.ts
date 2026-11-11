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

  it("drops NUL characters, which a stored text can't hold", async () => {
    const parsed = await parseDocument({
      bytes: new TextEncoder().encode("Guia do curso\u0000: módulo 1\u0000"),
      contentType: "text/plain",
    });

    expect(parsed.text).toBe("Guia do curso: módulo 1");
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

  it("leaves out a law page's struck-through wording, which the law no longer says", async () => {
    const page = [
      "<p><strike>Art. 4º Configura conflito de interesses o exercício de atividade privada.</strike></p>",
      "<p>Art. 4º O ocupante de cargo deve agir de modo a prevenir conflito de interesses.</p>",
      "<p>§ 2º A ocorrência de conflito <s>exige</s> independe da existência de lesão.</p>",
    ].join("");

    const law = await parseDocument({
      bytes: Buffer.from(page),
      contentType: "text/html",
      topic: "regulation",
    });

    const notice = await parseDocument({ bytes: Buffer.from(page), contentType: "text/html" });

    expect(law.text).toBe(
      "Art. 4º O ocupante de cargo deve agir de modo a prevenir conflito de interesses.\n§ 2º A ocorrência de conflito  independe da existência de lesão.",
    );

    expect(notice.text).toContain("Configura conflito de interesses");
  });

  it("reads a page sent in windows-1252 with no declared charset, as Planalto sends laws", async () => {
    const page = "<p>Presidência da República</p><p>LEI Nº 12.813, DE 16 DE MAIO DE 2013</p>";
    const text = "Presidência da República\nLEI Nº 12.813, DE 16 DE MAIO DE 2013";

    const [html, plain] = await Promise.all([
      parseDocument({ bytes: Buffer.from(page, "latin1"), contentType: "text/html" }),
      parseDocument({ bytes: Buffer.from(text, "latin1"), contentType: "text/plain" }),
    ]);

    expect([html.text, plain.text]).toStrictEqual([text, text]);
  });

  it("reads a note that quotes a <meta> charset in its own encoding", async () => {
    const note = `Write <meta charset="windows-1252"> in the head.\nCafé 日本語`;

    const parsed = await parseDocument({
      bytes: new TextEncoder().encode(note),
      contentType: "text/markdown",
    });

    expect(parsed.text).toBe(note);
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
