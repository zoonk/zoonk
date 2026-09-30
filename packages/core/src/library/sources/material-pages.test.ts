import { describe, expect, it } from "vitest";
import {
  findMaterialPage,
  formatMaterialIndex,
  formatMaterialPages,
  selectMaterialPages,
  selectSourcePages,
  toMaterialPages,
} from "./material-pages";
import { PAGE_BREAK, PPTX_CONTENT_TYPE } from "./source-contract";

const slides = {
  id: "deck",
  mimeType: PPTX_CONTENT_TYPE,
  text: ["Glicólise", "", "Fase de investimento: gasta 2 ATP", "Saldo: 2 ATP por glicose"].join(
    PAGE_BREAK,
  ),
  title: "Aula 5",
};

const notes = {
  id: "notes",
  mimeType: "text/plain",
  text: "Krebs cycle notes.\n\nEach acetyl-CoA gives 3 NADH.",
  title: "My notes",
};

describe(toMaterialPages, () => {
  it("numbers slides as the deck does, skips empty ones and keeps unpaged text as sections", () => {
    expect(toMaterialPages([slides, notes])).toStrictEqual([
      { page: 1, ref: "S1:1", sourceId: "deck", text: "Glicólise", title: "Aula 5", unit: "slide" },
      {
        page: 3,
        ref: "S1:3",
        sourceId: "deck",
        text: "Fase de investimento: gasta 2 ATP",
        title: "Aula 5",
        unit: "slide",
      },
      {
        page: 4,
        ref: "S1:4",
        sourceId: "deck",
        text: "Saldo: 2 ATP por glicose",
        title: "Aula 5",
        unit: "slide",
      },
      {
        page: null,
        ref: "S2:1",
        sourceId: "notes",
        text: "Krebs cycle notes.\n\nEach acetyl-CoA gives 3 NADH.",
        title: "My notes",
        unit: "section",
      },
    ]);
  });
});

describe(selectMaterialPages, () => {
  const pages = toMaterialPages([slides, notes]);

  it("keeps short material whole", () => {
    expect(selectMaterialPages({ pages, query: "anything" })).toStrictEqual(pages);
  });

  it("picks the pages that share the lesson's words, in their order, within the size", () => {
    const picked = selectMaterialPages({
      maxCharacters: 60,
      pages,
      query: "O saldo de ATP na fase de investimento",
    });

    expect(picked.map((page) => page.ref)).toStrictEqual(["S1:3", "S1:4"]);
  });

  it("falls back to the first pages when nothing matches", () => {
    const picked = selectMaterialPages({ maxCharacters: 20, pages, query: "zzzz" });
    expect(picked.map((page) => page.ref)).toStrictEqual(["S1:1"]);
  });
});

describe(selectSourcePages, () => {
  const pages = toMaterialPages([slides, notes]);

  it("picks only passages close enough to the lesson, even when the document is short", () => {
    const picked = selectSourcePages({
      maxCharacters: 1000,
      minShared: 2,
      pages,
      query: "O saldo de ATP por glicose",
    });

    expect(picked.map((page) => page.ref)).toStrictEqual(["S1:4"]);
  });

  it("picks nothing when no passage is about the lesson", () => {
    expect(
      selectSourcePages({ maxCharacters: 1000, minShared: 2, pages, query: "zzzz" }),
    ).toStrictEqual([]);
  });
});

describe(formatMaterialPages, () => {
  it("tags each page with its reference and where it's from", () => {
    const [first] = toMaterialPages([slides]);

    expect(formatMaterialPages(first ? [first] : [])).toBe(
      '<page ref="S1:1" of="Aula 5, slide 1">\nGlicólise\n</page>',
    );

    expect(formatMaterialIndex(first ? [first] : [])).toBe("[Aula 5, slide 1] Glicólise");
  });
});

describe(findMaterialPage, () => {
  it("finds a cited page and ignores references to pages it wasn't given", () => {
    const pages = toMaterialPages([slides]);

    expect(findMaterialPage({ pages, ref: " S1:3 " })?.page).toBe(3);
    expect(findMaterialPage({ pages, ref: "S1:9" })).toBeNull();
    expect(findMaterialPage({ pages, ref: null })).toBeNull();
  });
});
