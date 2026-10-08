import { describe, expect, it } from "vitest";
import { putCoresFirst } from "./core-first";
import { type QueueUnit } from "./plan-units";

function lesson(skillId: string, index: number, attrs: Partial<QueueUnit> = {}): QueueUnit {
  return {
    area: skillId,
    chapterId: "chapter",
    key: `lesson:${skillId}-${index}`,
    kind: "lesson",
    lessonId: `${skillId}-${index}`,
    minutes: 3,
    phase: 0,
    skillId,
    title: `${skillId} ${index}`,
    ...attrs,
  };
}

function standIn(skillId: string, lessons: number): QueueUnit {
  return {
    ...lesson(skillId, 0),
    chapterId: null,
    key: `skill:${skillId}`,
    lessonId: null,
    lessons,
    minutes: lessons * 3,
  };
}

function boss(phase: number): QueueUnit {
  return {
    ...lesson("boss", phase),
    key: `boss:${phase}`,
    kind: "boss",
    lessonId: null,
    phase,
    skillId: null,
  };
}

/** The lessons a skill of `lessons` plans in its core. */
function coreOf(lessons: number) {
  return putCoresFirst([standIn("a", lessons)]).find((unit) => !unit.depth)?.lessons;
}

describe(putCoresFirst, () => {
  it("puts every skill's first third first, then every area's rest in turn", () => {
    const units = [
      ...Array.from({ length: 6 }, (_, index) => lesson("a", index)),
      boss(0),
      ...Array.from({ length: 3 }, (_, index) => lesson("b", index, { phase: 1 })),
      boss(1),
    ];

    const arranged = putCoresFirst(units);

    // A phase's checkpoint follows its cores; the last one still closes the plan. The depth takes
    // each area in turn, at the same pace through its own, so a plan cut short keeps some of each.
    expect(arranged.map((unit) => [unit.key, unit.depth ?? false])).toStrictEqual([
      ["lesson:a-0", false],
      ["lesson:a-1", false],
      ["boss:0", false],
      ["lesson:b-0", false],
      ["lesson:a-2", true],
      ["lesson:b-1", true],
      ["lesson:a-3", true],
      ["lesson:a-4", true],
      ["lesson:b-2", true],
      ["lesson:a-5", true],
      ["boss:1", false],
    ]);
  });

  it("splits a stand-in at its skill's core, keeping its key and its minutes", () => {
    const [core, ...rest] = putCoresFirst([lesson("a", 0), standIn("a", 8)]);
    const depth = rest.at(-1);

    // Nine lessons in all: three in the core, the outlined one and two of the stand-in's.
    expect(core).toMatchObject({ key: "lesson:a-0" });
    expect(core?.depth).toBeUndefined();
    expect(rest[0]).toMatchObject({ key: "skill:a", lessons: 2, minutes: 6 });
    expect(depth).toMatchObject({ depth: true, key: "skill:a", lessons: 6, minutes: 18 });
  });

  it("keeps an outcome skill whole in the core", () => {
    const units = Array.from({ length: 4 }, (_, index) =>
      lesson("portfolio", index, { outcome: true }),
    );

    expect(putCoresFirst(units).some((unit) => unit.depth)).toBe(false);
  });

  it("counts the lessons a skill already has in the plan toward its core", () => {
    // Skill a has two of its six lessons done or kept this week: its core is in already.
    const units = [
      ...Array.from({ length: 4 }, (_, index) => lesson("a", index + 2)),
      ...Array.from({ length: 6 }, (_, index) => lesson("b", index)),
    ];

    const arranged = putCoresFirst(units, { kept: new Map([["a", 2]]) });

    expect(arranged.filter((unit) => !unit.depth).map((unit) => unit.key)).toStrictEqual([
      "lesson:b-0",
      "lesson:b-1",
    ]);
  });

  it("gives every skill at least one core lesson, and a third of a long one", () => {
    expect(coreOf(2)).toBe(1);
    expect(coreOf(30)).toBe(10);
  });
});
