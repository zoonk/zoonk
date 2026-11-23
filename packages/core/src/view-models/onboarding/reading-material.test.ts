import { describe, expect, it } from "vitest";
import { toSourcePages } from "../../library/sources/material-pages";
import { PAGE_BREAK, PDF_CONTENT_TYPE } from "../../library/sources/source-contract";
import { formatReadingMaterial } from "./reading-material";

const note = {
  contentHash: "note-hash",
  id: "note",
  mimeType: "text/plain",
  text: "Cell cycle: interphase (G1, S, G2), then mitosis and cytokinesis.",
  title: "",
};

const textbook = {
  contentHash: "book-hash",
  id: "book",
  mimeType: PDF_CONTENT_TYPE,
  text: Array.from(
    { length: 40 },
    (_, page) => `Chapter ${page + 1}: ${"Photosynthesis in detail. ".repeat(30)}`,
  ).join(PAGE_BREAK),
  title: "Biology.pdf",
};

describe(formatReadingMaterial, () => {
  it("reads nothing without material", () => {
    expect(formatReadingMaterial({ sources: [] })).toBeNull();
  });

  it("gives a long file only its share, so a short note beside it stays whole", () => {
    const material = formatReadingMaterial({ maxCharacters: 3000, sources: [note, textbook] });
    const [noteOverview, bookOverview] = material?.split("\n</page>\n") ?? [];

    expect(noteOverview).toBe(`<page ref="S1:1" of="">\n${note.text}`);
    expect(bookOverview?.length).toBeLessThanOrEqual(1500);
    expect(bookOverview).toMatch(/^\[Biology\.pdf, page 1\] Chapter 1: Photosynthesis/u);
    expect(bookOverview).toContain("[Biology.pdf, page 2] Chapter 2:");
  });

  it("gives one file the whole budget", () => {
    const pages = toSourcePages({ index: 0, source: textbook });
    const material = formatReadingMaterial({ maxCharacters: 6000, sources: [textbook] });

    expect(material).toHaveLength(6000);
    expect(material?.split("\n").length).toBeLessThan(pages.length);
  });
});
