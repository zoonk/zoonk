import { describe, expect, it } from "vitest";
import { filterCardGroups } from "./card-filter";
import { type ContentCard, type ContentGroup } from "./content-context";

const counts = { fading: 0, learning: 0, mastered: 0, new: 0, solid: 0, total: 0 };

function card(name: string, overrides: Partial<ContentCard> = {}): ContentCard {
  return {
    description: `${name} described`,
    example: null,
    fading: false,
    name,
    recallDays: 0,
    retrievability: null,
    skillId: name,
    state: "learning",
    ...overrides,
  };
}

function group(areaId: string, cards: ContentCard[]): ContentGroup {
  return { areaId, cards, counts, section: null, title: areaId };
}

const groups = [
  group("light", [card("Fótons"), card("Wavelength", { fading: true })]),
  group("atom", [card("Orbitals", { state: "mastered" }), card("Nucleus", { state: "new" })]),
];

describe(filterCardGroups, () => {
  it("returns every group unchanged without a search or filter", () => {
    expect(filterCardGroups({ filter: "all", groups, query: "" })).toStrictEqual(groups);
  });

  it("filters by state and drops empty groups", () => {
    const gold = filterCardGroups({ filter: "gold", groups, query: "" });
    expect(gold.map((item) => item.areaId)).toStrictEqual(["atom"]);
    expect(gold[0]?.cards.map((item) => item.name)).toStrictEqual(["Orbitals"]);

    const fading = filterCardGroups({ filter: "fading", groups, query: "" });

    expect(fading.flatMap((item) => item.cards.map((entry) => entry.name))).toStrictEqual([
      "Wavelength",
    ]);
  });

  it("searches names and text ignoring case and accents", () => {
    const found = filterCardGroups({ filter: "all", groups, query: "FOTONS" });

    expect(found.flatMap((item) => item.cards.map((entry) => entry.name))).toStrictEqual([
      "Fótons",
    ]);

    expect(filterCardGroups({ filter: "all", groups, query: "  NUCLEUS described " })).toHaveLength(
      1,
    );

    expect(filterCardGroups({ filter: "new", groups, query: "orbitals" })).toHaveLength(0);
  });

  it("filters a thousand cards quickly", () => {
    const many = Array.from({ length: 40 }, (_, area) =>
      group(
        `area-${area}`,
        Array.from({ length: 25 }, (_card, index) =>
          card(`Skill ${area}-${index}`, { fading: index % 4 === 0 }),
        ),
      ),
    );

    const start = performance.now();
    const found = filterCardGroups({ filter: "fading", groups: many, query: "skill 3" });

    expect(performance.now() - start).toBeLessThan(100);
    expect(found.length).toBeGreaterThan(0);
  });
});
