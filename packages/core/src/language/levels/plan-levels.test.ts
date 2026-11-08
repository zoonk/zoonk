import { randomUUID } from "node:crypto";
import { type PlanItem } from "@zoonk/db";
import { CEFR_LEVELS, type CefrLevel } from "@zoonk/utils/cefr";
import { describe, expect, it } from "vitest";
import { type CountedLesson, type UnwrittenLessons } from "../../plans/_utils/half-studied";
import {
  type LevelItem,
  type LevelSkill,
  getPlanLevelLabel,
  getUnitLevels,
  listPlanLevels,
} from "./plan-levels";

const SKILLS = new Map<string, LevelSkill>([
  ...CEFR_LEVELS.map((level): [string, LevelSkill] => [level, { cefrLevel: level, level: null }]),
  ["A-untagged", { cefrLevel: null, level: "beginner" }],
  ["B-untagged", { cefrLevel: null, level: "intermediate" }],
]);

type LessonOptions = { chapterId?: string; status?: PlanItem["status"] };

function lesson(skillId: string, { chapterId, status = "done" }: LessonOptions = {}): LevelItem {
  return {
    chapterId: chapterId ?? `unit-${skillId}`,
    completedAt: status === "todo" ? null : new Date("2026-11-02T15:00:00Z"),
    kind: "lesson",
    lessonId: randomUUID(),
    lessons: null,
    minutes: 4,
    skillId,
    status,
  };
}

function lessons(skillId: string, count: number, options: LessonOptions = {}): LevelItem[] {
  return Array.from({ length: count }, () => lesson(skillId, options));
}

function standIn(skillId: string, size: number, status: PlanItem["status"] = "todo"): LevelItem {
  return { ...lesson(skillId, { status }), chapterId: null, lessonId: null, lessons: size };
}

/** Written lessons the plan doesn't hold, each teaching these skills. */
function written(skillIds: string[], count: number): CountedLesson[] {
  return Array.from({ length: count }, () => ({
    chapterId: null,
    lessonId: randomUUID(),
    skillIds,
  }));
}

function unwritten(skillId: string, count: number): UnwrittenLessons {
  return { lessons: count, skillId };
}

/** The plan counts each item's lesson at the item's skill unless `taught` says what it teaches. */
function levels({
  heldBackLessonIds,
  items,
  missing = [],
  taught = [],
}: {
  heldBackLessonIds?: Set<string>;
  items: LevelItem[];
  missing?: UnwrittenLessons[];
  taught?: CountedLesson[];
}) {
  const taughtIds = new Set(taught.map((entry) => entry.lessonId));

  const held = items.flatMap((item) =>
    item.kind === "lesson" && item.lessonId && !taughtIds.has(item.lessonId)
      ? [
          {
            chapterId: item.chapterId,
            lessonId: item.lessonId,
            skillIds: item.skillId ? [item.skillId] : [],
          },
        ]
      : [],
  );

  return listPlanLevels({
    heldBackLessonIds,
    items,
    scope: {
      graphSkillIds: [...new Set(items.flatMap((item) => item.skillId ?? []))],
      lessons: [...taught, ...held],
      unwritten: missing,
    },
    skills: SKILLS,
  });
}

function earned(list: ReturnType<typeof levels>): CefrLevel[] {
  return list.filter((entry) => entry.earned).map((entry) => entry.level);
}

function at(list: ReturnType<typeof levels>, level: CefrLevel) {
  return list.find((entry) => entry.level === level);
}

describe(listPlanLevels, () => {
  it("earns nothing for a dated plan that finished the third of each skill it kept", () => {
    const list = levels({
      items: [...lessons("A1", 10), ...lessons("A2", 10)],
      missing: [unwritten("A1", 20), unwritten("A2", 20), unwritten("B1", 24)],
    });

    expect(earned(list)).toStrictEqual([]);
    expect(at(list, "A1")).toMatchObject({ size: 30, studied: 10 });
    expect(at(list, "B1")).toMatchObject({ size: 24, studied: 0 });
  });

  it("earns every level, C2 included, for a plan with two thirds of each studied", () => {
    const list = levels({
      items: CEFR_LEVELS.flatMap((level) => lessons(level, 20)),
      missing: CEFR_LEVELS.map((level) => unwritten(level, 10)),
    });

    expect(earned(list)).toStrictEqual([...CEFR_LEVELS]);
  });

  it("sizes a level by its written lessons and what its skills lack, not by the items it holds", () => {
    const list = levels({
      items: [...lessons("A1", 3), ...lessons("A2", 2), standIn("A2", 2, "testedOut")],
      missing: [unwritten("A2", 2)],
      taught: written(["A1"], 3),
    });

    expect(at(list, "A1")).toMatchObject({ earned: true, size: 6, studied: 3 });
    expect(at(list, "A2")).toMatchObject({ earned: true, size: 4, studied: 2 });
  });

  it("counts a lesson that teaches two levels once, at the lower one, whichever skill holds it", () => {
    const filedA1 = lessons("A1", 4, { status: "testedOut" });
    const filedA2 = lessons("A2", 4);

    const list = levels({
      items: [...filedA1, ...filedA2],
      taught: [...filedA1, ...filedA2].map((item) => ({
        chapterId: item.chapterId,
        lessonId: item.lessonId ?? "",
        skillIds: ["A1", "A2"],
      })),
    });

    expect(at(list, "A1")).toMatchObject({ earned: true, size: 8, studied: 4 });
    expect(at(list, "A1")?.items).toHaveLength(8);
    expect(at(list, "A2")).toMatchObject({ earned: false, items: [], size: 0 });
  });

  it("leaves a lesson untagged only while an untagged skill could put it lower", () => {
    const item = lesson("A2");

    const level = (skillIds: string[]) =>
      levels({
        items: [item],
        taught: [{ chapterId: item.chapterId, lessonId: item.lessonId ?? "", skillIds }],
      });

    expect(earned(level(["A2", "B-untagged"]))).toStrictEqual(["A2"]);
    expect(earned(level(["A2", "A-untagged"]))).toStrictEqual([]);
    expect(at(level(["A2", "A-untagged"]), "A1")?.items).toStrictEqual([item]);
  });

  it("holds a level and every one above it while a lesson at or below it is left to do", () => {
    const list = levels({
      items: [...lessons("A1", 1), ...lessons("A1", 1, { status: "todo" }), ...lessons("A2", 2)],
    });

    expect(earned(list)).toStrictEqual([]);
  });

  it("earns two levels together when the lower one's last lesson finishes", () => {
    const items = [...lessons("A1", 1), ...lessons("A2", 2)];
    const last = lessons("A1", 1, { status: "todo" });

    expect(earned(levels({ items: [...items, ...last] }))).toStrictEqual([]);

    const finished = last.map((item) => ({ ...item, status: "done" as const }));

    expect(earned(levels({ items: [...items, ...finished] }))).toStrictEqual(["A1", "A2"]);
  });

  it("earns B1 for a learner placed at B1 once B1 is finished, while B2 is still to do", () => {
    const list = levels({ items: [...lessons("B1", 4), ...lessons("B2", 4, { status: "todo" })] });

    expect(earned(list)).toStrictEqual(["B1"]);
  });

  it("leaves a level with a lesson set aside uncertified, but not the levels above it", () => {
    const skipped = lessons("A1", 1, { status: "skipped" });
    const items = [...lessons("A1", 2), ...skipped, ...lessons("A2", 2)];

    expect(earned(levels({ items }))).toStrictEqual(["A2"]);

    const heldBack = new Set(skipped.flatMap((item) => item.lessonId ?? []));

    expect(earned(levels({ heldBackLessonIds: heldBack, items }))).toStrictEqual(["A1", "A2"]);
  });

  it("certifies no level of a band while one of its skills is untagged", () => {
    const list = levels({
      items: [
        ...lessons("A1", 2),
        ...lessons("B1", 2),
        ...lessons("B-untagged", 2),
        ...lessons("B2", 2),
      ],
    });

    expect(earned(list)).toStrictEqual(["A1"]);
  });

  it("leaves challenges, calls and chapter rows out", () => {
    const others = (["boss", "checkpoint", "chapter", "review"] as const).map((kind) => ({
      ...lesson("A1", { status: "todo" }),
      kind,
    }));

    expect(earned(levels({ items: [...lessons("A1", 2), ...others] }))).toStrictEqual(["A1"]);
  });
});

function label(items: LevelItem[]) {
  return getPlanLevelLabel(levels({ items }));
}

describe(getPlanLevelLabel, () => {
  it("reads B1, then B1+ once half of B1 is finished, then B2 for a learner placed at B1", () => {
    const b2 = lessons("B2", 4, { status: "todo" });

    expect(label([...lessons("B1", 1), ...lessons("B1", 3, { status: "todo" }), ...b2])).toBe("B1");

    expect(
      label([
        ...lessons("B1", 1),
        ...lessons("B1", 1, { status: "testedOut" }),
        ...lessons("B1", 2, { status: "todo" }),
        ...b2,
      ]),
    ).toBe("B1+");

    expect(label([...lessons("B1", 4), ...b2])).toBe("B2");
  });

  it("reads the plan's highest level once nothing is left, with no plus on C2", () => {
    expect(label([...lessons("A1", 2), ...lessons("A2", 2)])).toBe("A2+");
    expect(label(lessons("C2", 2))).toBe("C2");
  });

  it("moves past a level whose only lessons left were set aside", () => {
    expect(
      label([...lessons("A1", 2, { status: "skipped" }), ...lessons("A2", 2, { status: "todo" })]),
    ).toBe("A2");
  });

  it("counts untagged lessons at their band's lower level", () => {
    expect(label([...lessons("A2", 2), ...lessons("B-untagged", 2, { status: "todo" })])).toBe(
      "B1",
    );

    expect(label(lessons("A-untagged", 2, { status: "todo" }))).toBe("A1");
  });

  it("has no level for a plan without lessons", () => {
    expect(label([])).toBeNull();
  });
});

describe(getUnitLevels, () => {
  it("puts a unit that mixes levels on its highest", () => {
    const list = levels({
      items: [
        ...lessons("A1", 1, { chapterId: "mixed" }),
        ...lessons("A2", 1, { chapterId: "mixed" }),
        ...lessons("A1", 1, { chapterId: "first" }),
      ],
    });

    expect(getUnitLevels(list)).toStrictEqual(
      new Map([
        ["mixed", "A2"],
        ["first", "A1"],
      ]),
    );
  });
});
