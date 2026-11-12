import { describe, expect, it } from "vitest";
import { foundNoCountry, matchesCountry } from "./country-search";

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

describe(foundNoCountry, () => {
  it("waits for the full list before saying a search found nothing", () => {
    expect(foundNoCountry({ found: 0, searching: true, status: "failed" })).toBe(false);
    expect(foundNoCountry({ found: 0, searching: true, status: "loading" })).toBe(false);
    expect(foundNoCountry({ found: 0, searching: true, status: "ready" })).toBe(true);
  });

  it("finds something when a search has results or there's no search", () => {
    expect(foundNoCountry({ found: 2, searching: true, status: "ready" })).toBe(false);
    expect(foundNoCountry({ found: 0, searching: false, status: "ready" })).toBe(false);
  });
});
