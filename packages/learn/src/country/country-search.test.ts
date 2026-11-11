import { describe, expect, it } from "vitest";
import { matchesCountry } from "./country-search";

describe(matchesCountry, () => {
  it("matches the start of any word, ignoring case and accents", () => {
    expect(matchesCountry({ name: "Estados Unidos", query: "uni" })).toBe(true);
    expect(matchesCountry({ name: "Reino Unido", query: "UNI" })).toBe(true);
    expect(matchesCountry({ name: "Japão", query: "japao" })).toBe(true);
    expect(matchesCountry({ name: "Côte d’Ivoire", query: "ivoire" })).toBe(true);
    expect(matchesCountry({ name: "Guiné-Bissau", query: "bissau" })).toBe(true);
  });

  it("matches several words in a row", () => {
    expect(
      matchesCountry({ name: "República Democrática do Congo", query: "democratica do" }),
    ).toBe(true);
  });

  it("doesn't match inside a word", () => {
    expect(matchesCountry({ name: "Venezuela", query: "ez" })).toBe(false);
  });
});
