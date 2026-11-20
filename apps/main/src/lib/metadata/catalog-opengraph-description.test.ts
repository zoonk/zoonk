import { describe, expect, it } from "vitest";
import { getCatalogImageDescription } from "./catalog-opengraph-description";

describe(getCatalogImageDescription, () => {
  it("preserves a short description with more than one sentence", () => {
    const description = "Measure the speed of light. Then compare the results.";
    expect(getCatalogImageDescription({ description, language: "en" })).toBe(description);
  });

  it("cuts a long German description at the last word that fits", () => {
    const visible =
      "Dieser Kurs erklärt, wie sich Energie in einem geschlossenen System verteilt und wie du mit einfachen Experimenten herausfindest, welche Beobachtungen deine erste Vermutung";

    const description = `${visible} unterstützen oder widerlegen und warum das wichtig ist.`;

    expect(getCatalogImageDescription({ description, language: "de" })).toBe(`${visible}…`);
  });

  it("leaves an empty description empty", () => {
    expect(getCatalogImageDescription({ description: " ", language: "en" })).toBe("");
  });
});
