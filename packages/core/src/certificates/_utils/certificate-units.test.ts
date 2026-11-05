import { type CourseLevel, type PlanItem } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { type CertifiableItem, type LevelChapter, listCertificateUnits } from "./certificate-units";

const COURSE = "course";
const GOAL = { id: "goal", kind: "learn", targetDate: null } as const;
const PLAN_CREATED_AT = new Date("2026-10-01T12:00:00Z");
const BEFORE = new Date("2026-09-01T12:00:00Z");
const AFTER = new Date("2026-10-15T12:00:00Z");

function lesson({
  chapterId,
  level = "beginner",
  phase = 0,
  status = "done",
}: {
  chapterId: string | null;
  level?: CourseLevel | null;
  phase?: number;
  status?: PlanItem["status"];
}): CertifiableItem {
  return {
    chapterId,
    completedAt: status === "todo" ? null : AFTER,
    kind: "lesson",
    lessonId: null,
    lessons: null,
    level,
    minutes: 5,
    phase,
    skillId: null,
    status,
  };
}

function item(
  kind: PlanItem["kind"],
  { phase = 0, status = "done" }: { phase?: number; status?: PlanItem["status"] } = {},
): CertifiableItem {
  return { ...lesson({ chapterId: null, level: null, phase, status }), kind };
}

function chapter(chapterId: string, level: CourseLevel = "beginner", createdAt = BEFORE) {
  return { chapterId, createdAt, level, taughtInPlan: false } satisfies LevelChapter;
}

const TWO_LEVELS = {
  chapters: [chapter("o1", "overview"), chapter("o2", "overview"), chapter("b1"), chapter("b2")],
  items: [
    lesson({ chapterId: "o1", level: "overview" }),
    lesson({ chapterId: "o2", level: "overview" }),
    item("boss"),
    lesson({ chapterId: "b1", phase: 1 }),
    lesson({ chapterId: "b2", phase: 1 }),
    item("boss", { phase: 1 }),
  ],
};

function units({
  chapters = TWO_LEVELS.chapters,
  goal = GOAL,
  heldKeys = [],
  items = TWO_LEVELS.items,
  levelCourseId = COURSE,
  phases = [{}, {}],
  studiesPastTarget = false,
}: {
  chapters?: LevelChapter[];
  goal?: Parameters<typeof listCertificateUnits>[0]["goal"];
  heldKeys?: string[];
  items?: CertifiableItem[];
  levelCourseId?: string | null;
  phases?: { challengeLeftOut?: boolean }[];
  studiesPastTarget?: boolean;
} = {}) {
  return listCertificateUnits({
    goal,
    heldKeys: new Set(heldKeys),
    items,
    levelChapters: chapters,
    levelCourseId,
    phases,
    planCreatedAt: PLAN_CREATED_AT,
    studiesPastTarget,
  });
}

function finished(list: ReturnType<typeof units>) {
  return list.filter((unit) => unit.finished).map((unit) => unit.key);
}

describe(listCertificateUnits, () => {
  it("certifies each whole level its plan finishes, and no plan certificate when they cover it", () => {
    const list = units();

    expect(list.map((unit) => [unit.key, unit.courseLevel, unit.chapterIds])).toStrictEqual([
      ["course:overview", "overview", ["o1", "o2"]],
      ["course:beginner", "beginner", ["b1", "b2"]],
      ["goal", null, ["o1", "o2", "b1", "b2"]],
    ]);

    expect(finished(list)).toStrictEqual(["course:overview", "course:beginner"]);
  });

  it("finishes a level mid-plan once its phase challenge is won", () => {
    const items = TWO_LEVELS.items.map((entry) =>
      entry.phase === 1 ? { ...entry, completedAt: null, status: "todo" as const } : entry,
    );

    expect(finished(units({ items }))).toStrictEqual(["course:overview"]);

    const challengeLeft = items.map((entry) =>
      entry.kind === "boss" ? { ...entry, completedAt: null, status: "todo" as const } : entry,
    );

    expect(finished(units({ items: challengeLeft }))).toStrictEqual([]);

    expect(finished(units({ phases: [{ challengeLeftOut: true }, {}] }))).toStrictEqual([
      "course:beginner",
    ]);
  });

  it("certifies nothing tested out without one lesson studied", () => {
    const items = TWO_LEVELS.items.map((entry) =>
      entry.kind === "lesson" && entry.phase === 0
        ? { ...entry, status: "testedOut" as const }
        : entry,
    );

    expect(finished(units({ items }))).toStrictEqual(["course:beginner"]);

    const allTestedOut = TWO_LEVELS.items.map((entry) =>
      entry.kind === "lesson" ? { ...entry, status: "testedOut" as const } : entry,
    );

    expect(finished(units({ items: allTestedOut }))).toStrictEqual([]);
  });

  it("certifies a level started past its first chapter with the plan, and the next level whole", () => {
    const items = TWO_LEVELS.items.filter((entry) => entry.chapterId !== "o1");

    expect(finished(units({ items }))).toStrictEqual(["course:beginner", "goal"]);
  });

  it("certifies only the plan for a plan holding part of a level that predates it", () => {
    const items = [lesson({ chapterId: "b1" }), lesson({ chapterId: "b2" }), item("boss")];
    const chapters = ["b1", "b2", "b3", "b4"].map((id) => chapter(id));

    expect(finished(units({ chapters, items }))).toStrictEqual(["goal"]);
  });

  it("leaves out chapters attached after the plan began, and counts a level written for it", () => {
    const later = [...TWO_LEVELS.chapters, chapter("b3", "beginner", AFTER)];

    expect(finished(units({ chapters: later }))).toStrictEqual([
      "course:overview",
      "course:beginner",
    ]);

    const writtenForPlan = TWO_LEVELS.chapters.map((entry) => ({ ...entry, createdAt: AFTER }));
    const items = TWO_LEVELS.items.filter((entry) => entry.chapterId !== "o1");

    expect(finished(units({ chapters: writtenForPlan, items }))).toStrictEqual([
      "course:overview",
      "course:beginner",
    ]);
  });

  it("counts a chapter the plan left out as held when the plan teaches its skills elsewhere", () => {
    const items = TWO_LEVELS.items.filter((entry) => entry.chapterId !== "b2");

    const chapters = TWO_LEVELS.chapters.map((entry) =>
      entry.chapterId === "b2" ? { ...entry, taughtInPlan: true } : entry,
    );

    expect(finished(units({ chapters, items }))).toStrictEqual([
      "course:overview",
      "course:beginner",
    ]);
  });

  it("makes a level of a phase that mixes levels wait for that phase's challenge", () => {
    const items = [
      lesson({ chapterId: "o1", level: "overview" }),
      lesson({ chapterId: "o2", level: "overview" }),
      lesson({ chapterId: "b1" }),
      lesson({ chapterId: "b2", status: "todo" }),
      item("boss", { status: "todo" }),
    ];

    expect(finished(units({ items, phases: [{}] }))).toStrictEqual([]);
  });

  it("counts other courses' lessons toward the plan certificate only", () => {
    const items = [...TWO_LEVELS.items, lesson({ chapterId: "elsewhere", level: null, phase: 1 })];

    expect(finished(units({ items }))).toStrictEqual([
      "course:overview",
      "course:beginner",
      "goal",
    ]);

    const todo = [
      ...TWO_LEVELS.items,
      lesson({ chapterId: "elsewhere", level: null, status: "todo" }),
    ];

    expect(finished(units({ items: todo }))).toStrictEqual(["course:overview", "course:beginner"]);
  });

  it("certifies only the plan without a Library course's levels, or without lessons in them", () => {
    expect(finished(units({ levelCourseId: null }))).toStrictEqual(["goal"]);

    const elsewhere = TWO_LEVELS.items.map((entry) => ({ ...entry, level: null }));
    expect(finished(units({ items: elsewhere }))).toStrictEqual(["goal"]);
  });

  it("covers a partial level with the learner's certificate of it from another goal", () => {
    const items = TWO_LEVELS.items.filter((entry) => entry.chapterId !== "b1");

    expect(finished(units({ items }))).toStrictEqual(["course:overview", "goal"]);

    expect(finished(units({ heldKeys: ["course:beginner"], items }))).toStrictEqual([
      "course:overview",
    ]);
  });

  it("leaves an exam's mocks and reviews out", () => {
    const items = [
      ...TWO_LEVELS.items,
      item("mock", { status: "todo" }),
      item("review", { status: "todo" }),
    ];

    expect(finished(units({ goal: { ...GOAL, kind: "exam" }, items }))).toStrictEqual([
      "course:overview",
      "course:beginner",
    ]);
  });

  it("needs a lesson set aside by the goal's date, unless the plan has no deadline", () => {
    const items = TWO_LEVELS.items.map((entry) =>
      entry.chapterId === "b2" ? { ...entry, status: "skipped" as const } : entry,
    );

    const dated = { ...GOAL, targetDate: new Date("2026-12-01T00:00:00Z") };

    expect(finished(units({ goal: dated, items }))).toStrictEqual(["course:overview"]);

    expect(finished(units({ goal: dated, items, studiesPastTarget: true }))).toStrictEqual([
      "course:overview",
      "course:beginner",
    ]);

    expect(finished(units({ items }))).toStrictEqual(["course:overview", "course:beginner"]);
  });

  it("has no units for language and explain goals", () => {
    expect(units({ goal: { ...GOAL, kind: "language" } })).toStrictEqual([]);
    expect(units({ goal: { ...GOAL, kind: "explain" } })).toStrictEqual([]);
  });
});
