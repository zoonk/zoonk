import { describe, expect, it } from "vitest";
import { getCatalogImageDescription } from "./catalog-opengraph-description";

describe(getCatalogImageDescription, () => {
  it("keeps the first whole sentence and its punctuation", () => {
    expect(
      getCatalogImageDescription({
        description: "Measure the speed of light. Then compare the results.",
        language: "en",
      }),
    ).toBe("Measure the speed of light.");
  });

  it("finds sentence boundaries in text without spaces between them", () => {
    expect(
      getCatalogImageDescription({ description: "光の速さを測る。結果を比べる。", language: "ja" }),
    ).toBe("光の速さを測る。");
  });

  it("omits a sentence that does not fit on the card", () => {
    expect(
      getCatalogImageDescription({
        description: `Use this example to ${"think carefully and ".repeat(7)}test your prediction.`,
        language: "en",
      }),
    ).toBe("");
  });
});
