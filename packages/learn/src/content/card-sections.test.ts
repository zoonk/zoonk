import { describe, expect, it } from "vitest";
import { toCardSections } from "./card-sections";
import { type ContentGroup } from "./content-context";

function group(areaId: string, section: string | null, total: number): ContentGroup {
  return {
    areaId,
    cards: [],
    counts: { fading: 1, learning: total - 1, mastered: 0, new: 0, solid: 0, total },
    section,
    title: areaId,
  };
}

const all = [
  group("algebra", "Math", 4),
  group("geometry", "Math", 2),
  group("cells", "Science", 3),
];

describe(toCardSections, () => {
  it("splits chapters by section with totals for all of a section's cards", () => {
    const sections = toCardSections({ all, groups: all });

    expect(
      sections?.map((section) => [section.title, section.groups.length, section.counts.total]),
    ).toStrictEqual([
      ["Math", 2, 6],
      ["Science", 1, 3],
    ]);

    expect(sections?.[0]?.counts.fading).toBe(2);
  });

  it("keeps a section's totals while a search shows only some of its chapters", () => {
    const sections = toCardSections({ all, groups: all.slice(1, 2) });

    expect(sections?.map((section) => [section.title, section.counts.total])).toStrictEqual([
      ["Math", 6],
    ]);
  });

  it("shows a section's totals only when it has several chapters", () => {
    const sections = toCardSections({ all, groups: all });

    expect(sections?.map((section) => [section.title, section.header])).toStrictEqual([
      ["Math", "full"],
      ["Science", "title"],
    ]);
  });

  it("drops the header of a section whose only chapter has its title", () => {
    const withWriting = [...all, { ...group("writing", "Writing", 3), title: "Writing " }];
    const sections = toCardSections({ all: withWriting, groups: withWriting });

    expect(sections?.map((section) => section.header)).toStrictEqual(["full", "title", "none"]);
  });

  it("keeps a section's header while a search shows only one of its chapters", () => {
    const sections = toCardSections({ all, groups: all.slice(0, 1) });

    expect(sections?.map((section) => [section.title, section.header])).toStrictEqual([
      ["Math", "full"],
    ]);
  });

  it("shows no sections when every section is just its one same-named chapter", () => {
    const chapters = ["Waves", "Spin"].map((title) => group(title, title, 2));

    expect(toCardSections({ all: chapters, groups: chapters })).toBeNull();
  });

  it("shows no sections for a goal with one section, or none", () => {
    expect(
      toCardSections({ all: [group("a", "Math", 1), group("b", "Math", 1)], groups: all }),
    ).toBeNull();

    expect(toCardSections({ all: [group("a", null, 1)], groups: [] })).toBeNull();
  });
});
