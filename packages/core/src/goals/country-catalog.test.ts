import { describe, expect, it } from "vitest";
import { getCountrySuggestions } from "./_utils/country-suggestions";
import { getCountryCatalog } from "./country-catalog";

function recent(code: string, id: string) {
  return {
    contentCountry: code,
    details: {},
    examBlueprint: null,
    id,
    kind: "learn" as const,
    language: "pt",
  };
}

describe("country choices", () => {
  it("leads with three earlier countries, home, then the language's countries without duplicates", () => {
    const suggested = getCountrySuggestions({
      goalId: "current",
      homeCountry: "PT",
      language: "pt",
      recent: [
        recent("DE", "current"),
        recent("FR", "one"),
        recent("FR", "two"),
        recent("DE", "three"),
        recent("US", "four"),
        recent("GB", "five"),
      ],
    });

    expect(suggested.slice(0, 5)).toStrictEqual([
      { code: "FR", lessonVariety: null, name: "França", tag: null },
      { code: "DE", lessonVariety: null, name: "Alemanha", tag: null },
      { code: "US", lessonVariety: null, name: "Estados Unidos", tag: null },
      {
        code: "PT",
        lessonVariety: { language: "pt", region: "BR" },
        name: "Portugal",
        tag: "home",
      },
      { code: "BR", lessonVariety: null, name: "Brasil", tag: null },
    ]);

    expect(suggested.length).toBeLessThanOrEqual(8);
  });

  it("orders the language's own country first without selecting it", () => {
    const suggested = getCountrySuggestions({ homeCountry: null, language: "en", recent: [] });

    expect(suggested[0]).toStrictEqual({
      code: "US",
      lessonVariety: null,
      name: "United States",
      tag: null,
    });

    expect(suggested.every((choice) => choice.tag === null)).toBe(true);
    expect(suggested.length).toBeLessThanOrEqual(8);
  });

  it("lets the country question preview a different lesson variety before Continue", () => {
    const { countries } = getCountryCatalog("pt");

    expect(countries.find((country) => country.code === "PT")).toMatchObject({
      lessonVariety: { language: "pt", region: "BR" },
    });

    expect(countries.find((country) => country.code === "DE")).toMatchObject({
      lessonVariety: null,
    });
  });

  it("serves every country in localized name order, with no unknown-region entry", () => {
    const { countries } = getCountryCatalog("pt");
    expect(countries.length).toBeGreaterThan(240);

    expect(countries).toContainEqual({
      code: "PT",
      lessonVariety: { language: "pt", region: "BR" },
      name: "Portugal",
    });

    expect(countries.some((country) => country.code === "ZZ")).toBe(false);

    expect(countries).toStrictEqual(
      countries.toSorted((a, b) => new Intl.Collator("pt").compare(a.name, b.name)),
    );
  });
});
