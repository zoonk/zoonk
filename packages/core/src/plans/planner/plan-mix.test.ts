import { describe, expect, it } from "vitest";
import { mixAreas } from "./plan-mix";
import { type QueueUnit } from "./plan-units";

function lessons({
  area,
  chapters = 1,
  count,
  skillId,
}: {
  area: string;
  chapters?: number;
  count: number;
  skillId: string;
}): QueueUnit[] {
  const perChapter = Math.ceil(count / chapters);

  return Array.from({ length: count }, (_, index) => ({
    area,
    chapterId: `${skillId}-chapter-${Math.floor(index / perChapter)}`,
    key: `lesson:${skillId}-${index}`,
    kind: "lesson",
    lessonId: `${skillId}-${index}`,
    minutes: 3,
    phase: 0,
    skillId,
    title: `${skillId} ${index}`,
  }));
}

/** Consecutive units of the same area, as [area, lessons] pairs. */
function toRuns(units: readonly QueueUnit[]): [string, number][] {
  return units.reduce<[string, number][]>((runs, unit) => {
    const last = runs.at(-1);

    if (last && last[0] === unit.area) {
      last[1] += 1;
    } else {
      runs.push([unit.area, 1]);
    }

    return runs;
  }, []);
}

function countAreas(units: readonly QueueUnit[]): Record<string, number> {
  return Object.fromEntries(
    [...new Set(units.map((unit) => unit.area))].map((area) => [
      area,
      units.filter((unit) => unit.area === area).length,
    ]),
  );
}

describe(mixAreas, () => {
  it("gives each area time in proportion to what it's worth, in runs of a few lessons", () => {
    const units = [
      ...lessons({ area: "Portuguese", count: 30, skillId: "reading" }),
      ...lessons({ area: "Logic", count: 30, skillId: "propositions" }),
      ...lessons({ area: "Fitness", count: 30, skillId: "training" }),
    ];

    const mixed = mixAreas({
      prerequisites: new Map(),
      rates: new Map([
        ["reading", 5],
        ["propositions", 3],
        ["training", 1],
      ]),
      units,
    });

    const firstDay = countAreas(mixed.slice(0, 20));

    expect(toRuns(mixed.slice(0, 20))).toStrictEqual([
      ["Portuguese", 5],
      ["Logic", 5],
      ["Portuguese", 10],
    ]);

    expect(countAreas(mixed.slice(0, 45))).toStrictEqual({ Fitness: 5, Logic: 15, Portuguese: 25 });
    expect(firstDay.Portuguese).toBeLessThan(20);

    expect(mixed.map((unit) => unit.key).toSorted()).toStrictEqual(
      units.map((unit) => unit.key).toSorted(),
    );

    expect(mixed.filter((unit) => unit.skillId === "reading")).toStrictEqual(
      units.filter((unit) => unit.skillId === "reading"),
    );
  });

  it("ends a run where its chapter ends", () => {
    const mixed = mixAreas({
      prerequisites: new Map(),
      rates: new Map([
        ["reading", 1],
        ["propositions", 1],
      ]),
      units: [
        ...lessons({ area: "Portuguese", chapters: 3, count: 9, skillId: "reading" }),
        ...lessons({ area: "Logic", count: 9, skillId: "propositions" }),
      ],
    });

    expect(toRuns(mixed).slice(0, 2)).toStrictEqual([
      ["Portuguese", 3],
      ["Logic", 5],
    ]);

    expect(new Set(mixed.slice(0, 3).map((unit) => unit.chapterId)).size).toBe(1);
  });

  it("starts a skill after its prerequisites in other areas, without saving up time while it waits", () => {
    const units = [
      ...lessons({ area: "Basics", count: 5, skillId: "classes" }),
      ...lessons({ area: "Rewriting", count: 40, skillId: "rewrite" }),
      ...lessons({ area: "Law", count: 40, skillId: "constitution" }),
    ];

    const mixed = mixAreas({
      prerequisites: new Map([["rewrite", ["classes", "known-elsewhere"]]]),
      rates: new Map([
        ["classes", 1],
        ["constitution", 5],
        ["rewrite", 5],
      ]),
      units,
    });

    const firstRewrite = mixed.findIndex((unit) => unit.skillId === "rewrite");
    const lastBasics = mixed.findLastIndex((unit) => unit.skillId === "classes");

    expect(lastBasics).toBeLessThan(firstRewrite);

    const rewritingRuns = toRuns(mixed.slice(firstRewrite, firstRewrite + 40));

    expect(Math.max(...rewritingRuns.map(([, count]) => count))).toBeLessThanOrEqual(10);
    expect(rewritingRuns.filter(([area]) => area === "Law").length).toBeGreaterThan(2);
  });

  it("never stalls on a prerequisite cycle", () => {
    const units = [
      ...lessons({ area: "A", count: 3, skillId: "a" }),
      ...lessons({ area: "B", count: 3, skillId: "b" }),
    ];

    const mixed = mixAreas({
      prerequisites: new Map([
        ["a", ["b"]],
        ["b", ["a"]],
      ]),
      rates: new Map(),
      units,
    });

    expect(mixed.map((unit) => unit.key)).toStrictEqual(units.map((unit) => unit.key));
  });
});
