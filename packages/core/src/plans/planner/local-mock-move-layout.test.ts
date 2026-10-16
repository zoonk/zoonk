import { describe, expect, it } from "vitest";
import { type BuildPlanInput } from "./build-plan";
import { type StudyPortion } from "./interval-study-minutes";
import { layOutLocalMockMove } from "./local-mock-move-layout";
import { fromIsoDate } from "./plan-calendar";
import { type ExistingPlanItem, type PlannedItem, getItemKey } from "./plan-items";
import { parsePlanSettings } from "./plan-state";
import { type PlanDay } from "./schedule-units";

function lesson({
  id,
  position,
  portions,
}: {
  id: string;
  position: number;
  portions: readonly StudyPortion[];
}): ExistingPlanItem {
  const minutes = portions.reduce((sum, part) => sum + part.minutes, 0);
  const raw = portions.reduce((sum, part) => sum + part.lessonMinutes, 0);

  return {
    chapterId: null,
    completedAt: null,
    facts: {
      days: portions.map((part) => [part.date, part.minutes, part.lessonMinutes]),
      minutes,
      parts: { checkpoint: 0, practice: minutes - raw, unwritten: 0, written: raw },
      schemaVersion: 1,
      skillIds: [id],
    },
    id,
    kind: "lesson",
    lessonId: id,
    phase: 0,
    position,
    scheduledFor: fromIsoDate(portions.at(-1)?.date ?? "2020-10-05"),
    skillId: id,
    status: "todo",
    titleSnapshot: id,
  };
}

function event({ date, kind }: { date: string; kind: "boss" | "mock" }): ExistingPlanItem {
  return {
    chapterId: null,
    completedAt: null,
    id: kind,
    kind,
    lessonId: null,
    phase: 0,
    position: 10,
    scheduledFor: fromIsoDate(date),
    skillId: null,
    status: "todo",
    titleSnapshot: kind,
  };
}

function day({
  date,
  kind,
  minutes = 10,
  phase = 0,
  share = 0.6,
}: {
  date: string;
  kind?: "boss" | "mock";
  minutes?: number;
  phase?: number;
  share?: number;
}): PlanDay {
  return {
    date: fromIsoDate(date),
    shape: {
      events: kind
        ? [{ key: `${kind}:${date}`, kind, minutes: 10, replacesDay: true, title: kind }]
        : [],
      minutes,
      open: true,
      phase,
      share,
    },
  };
}

function move(items: ExistingPlanItem[], days: PlanDay[], today = "2020-10-04") {
  const input: BuildPlanInput = {
    goal: { dailyMinutes: 10, kind: "exam", targetDate: fromIsoDate("2020-10-10") },
    graph: { phases: [{ milestone: null, name: "Basics" }], skills: [] },
    items,
    keepSelection: true,
    lessons: [],
    mockMinutes: 10,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    requestedMoveDates: new Set(["2020-10-06"]),
    settings: parsePlanSettings({ movedEvents: [{ from: "2020-10-04", to: "2020-10-06" }] }),
    today: fromIsoDate(today),
  };

  const planned: PlannedItem[] = items.map((item) => ({
    ...item,
    key: getItemKey(item),
    minutes: 10,
    ...(item.kind === "mock" ? { scheduledFor: fromIsoDate("2020-10-06") } : {}),
  }));

  return layOutLocalMockMove({ days, input, items: planned, units: new Map() });
}

function intervalFixture(
  sourceMinutes: number,
  adjust: (item: ExistingPlanItem) => ExistingPlanItem = (item) => item,
) {
  const lessons = [
    { date: "2020-10-05", id: "before" },
    { date: "2020-10-06", id: "displaced" },
    { date: "2020-10-08", id: "outside" },
  ].map(({ date, id }, position) =>
    adjust(lesson({ id, portions: [{ date, lessonMinutes: 6, minutes: 10 }], position })),
  );

  const outside = lessons.find((item) => item.id === "outside");

  if (!outside) {
    throw new Error("Expected the pinned outside lesson");
  }

  const boss = event({ date: "2020-10-07", kind: "boss" });
  const mock = event({ date: "2020-10-04", kind: "mock" });
  const items = [...lessons, boss, mock];

  const result = move(items, [
    day({ date: "2020-10-04", minutes: sourceMinutes }),
    day({ date: "2020-10-05" }),
    day({ date: "2020-10-06", kind: "mock" }),
    day({ date: "2020-10-07", kind: "boss" }),
    day({ date: "2020-10-08" }),
  ]);

  return { boss, items, outside, result };
}

describe("a local mock move's displaced teaching", () => {
  it("keeps a long lesson's other day portions and the surrounding saved work fixed", () => {
    const before = lesson({
      id: "before",
      portions: [{ date: "2020-10-05", lessonMinutes: 1, minutes: 5 / 3 }],
      position: 0,
    });

    const portions = [
      { date: "2020-10-05", lessonMinutes: 2, minutes: 10 / 3 },
      { date: "2020-10-06", lessonMinutes: 3, minutes: 5 },
      { date: "2020-10-07", lessonMinutes: 2, minutes: 10 / 3 },
    ];

    const long = lesson({ id: "long", portions, position: 1 });

    const after = lesson({
      id: "after",
      portions: [{ date: "2020-10-07", lessonMinutes: 2, minutes: 10 / 3 }],
      position: 2,
    });

    const boss = event({ date: "2020-10-08", kind: "boss" });
    const mock = event({ date: "2020-10-04", kind: "mock" });
    const items = [before, long, after, boss, mock];

    const result = move(items, [
      day({ date: "2020-10-04" }),
      day({ date: "2020-10-05" }),
      day({ date: "2020-10-06", kind: "mock" }),
      day({ date: "2020-10-07" }),
      day({ date: "2020-10-08", kind: "boss" }),
    ]);

    expect(
      result.items.map((item) => item.id).toSorted((a, b) => (a ?? "").localeCompare(b ?? "")),
    ).toStrictEqual(items.map((item) => item.id).toSorted((a, b) => a.localeCompare(b)));

    expect(result.portions.get(getItemKey(long))).toStrictEqual([
      { date: "2020-10-05", lessonMinutes: 5, minutes: 25 / 3 },
      portions[2],
    ]);

    expect(result.portions.get(getItemKey(before))).toStrictEqual([
      { date: "2020-10-05", lessonMinutes: 1, minutes: 5 / 3 },
    ]);

    expect(result.portions.get(getItemKey(after))).toStrictEqual([
      { date: "2020-10-07", lessonMinutes: 2, minutes: 10 / 3 },
    ]);

    expect(result.items.find((item) => item.id === long.id)?.scheduledFor).toStrictEqual(
      long.scheduledFor,
    );

    expect(result.items.find((item) => item.id === boss.id)?.scheduledFor).toStrictEqual(
      boss.scheduledFor,
    );

    expect(result.items.find((item) => item.id === mock.id)?.scheduledFor).toStrictEqual(
      fromIsoDate("2020-10-06"),
    );

    expect(result.selectionShifts).toMatchObject([{ lessons: 1 }]);
  });

  it("refuses a local interval when it cannot retain all selected work", () => {
    const { items, result } = intervalFixture(5);

    expect(result.items.some((item) => item.kind === "mock")).toBe(false);

    expect(result.items.map((item) => item.id)).toStrictEqual(
      items.filter((item) => item.kind !== "mock").map((item) => item.id),
    );

    expect(result.portions.get("lesson:displaced")).toStrictEqual([
      { date: "2020-10-06", lessonMinutes: 6, minutes: 10 },
    ]);

    expect(result.selectionShifts).toStrictEqual([]);
  });

  it("uses only the smallest fitting selected interval", () => {
    const { boss, items, outside, result } = intervalFixture(10);

    expect(result.items.some((item) => item.kind === "mock")).toBe(true);

    expect(
      result.items.map((item) => item.id).toSorted((a, b) => (a ?? "").localeCompare(b ?? "")),
    ).toStrictEqual(items.map((item) => item.id).toSorted((a, b) => a.localeCompare(b)));

    expect(
      result.items.filter((item) => item.kind === "lesson").map((item) => item.id),
    ).toStrictEqual(["before", "displaced", "outside"]);

    expect(result.items.find((item) => item.id === "before")?.scheduledFor).toStrictEqual(
      fromIsoDate("2020-10-04"),
    );

    expect(result.items.find((item) => item.id === "displaced")?.scheduledFor).toStrictEqual(
      fromIsoDate("2020-10-05"),
    );

    expect(result.items.find((item) => item.id === boss.id)).toStrictEqual({
      ...boss,
      key: getItemKey(boss),
      minutes: 10,
    });

    expect(result.items.find((item) => item.id === outside.id)).toStrictEqual({
      ...outside,
      key: getItemKey(outside),
      minutes: 10,
    });

    expect(result.selectionShifts).toStrictEqual([
      {
        from: "2020-10-04",
        itemKeys: ["lesson:before", "lesson:displaced"],
        lessons: 2,
        to: "2020-10-06",
      },
    ]);
  });

  it.each([false, true])(
    "keeps an aggregate shift's lesson count unknown, raw present: %s",
    (raw) => {
      const { result } = intervalFixture(10, (item) =>
        item.id === "displaced"
          ? {
              ...lesson({
                id: item.id,
                portions: [{ date: "2020-10-06", lessonMinutes: raw ? 6 : 0, minutes: 10 }],
                position: item.position,
              }),
              lessonId: null,
            }
          : item,
      );

      expect(result.selectionShifts).toMatchObject([{ lessons: null }]);
    },
  );

  it("counts a single-day written identity with zero fallback raw and no live lesson", () => {
    const { result } = intervalFixture(10, (item) =>
      item.id === "displaced"
        ? lesson({
            id: item.id,
            portions: [{ date: "2020-10-06", lessonMinutes: 0, minutes: 10 }],
            position: item.position,
          })
        : item,
    );

    expect(result.selectionShifts).toMatchObject([{ lessons: 2 }]);
  });

  it("does not count a multiday lesson when only its practice changes days", () => {
    const { result } = intervalFixture(10, (item) =>
      item.id === "before"
        ? lesson({
            id: item.id,
            portions: [
              { date: "2020-10-03", lessonMinutes: 6, minutes: 10 },
              { date: "2020-10-05", lessonMinutes: 0, minutes: 10 },
            ],
            position: item.position,
          })
        : item,
    );

    expect(result.selectionShifts).toStrictEqual([
      { from: "2020-10-04", itemKeys: ["lesson:displaced"], lessons: 1, to: "2020-10-06" },
    ]);
  });

  it("keeps the first lesson's early due date when a later portion is displaced", () => {
    const early = {
      ...lesson({
        id: "early",
        portions: [
          { date: "2020-10-01", lessonMinutes: 6, minutes: 10 },
          { date: "2020-10-06", lessonMinutes: 3, minutes: 5 },
          { date: "2020-10-07", lessonMinutes: 3, minutes: 5 },
        ],
        position: 0,
      }),
      scheduledFor: fromIsoDate("2020-10-01"),
    };

    const boss = event({ date: "2020-10-08", kind: "boss" });
    const mock = event({ date: "2020-10-04", kind: "mock" });

    const result = move(
      [early, boss, mock],
      [
        day({ date: "2020-10-01" }),
        day({ date: "2020-10-04" }),
        day({ date: "2020-10-06", kind: "mock" }),
        day({ date: "2020-10-07" }),
        day({ date: "2020-10-08", kind: "boss" }),
      ],
      "2020-10-01",
    );

    expect(result.items.find((item) => item.id === early.id)?.scheduledFor).toStrictEqual(
      early.scheduledFor,
    );

    expect(result.portions.get(getItemKey(early))).toContainEqual({
      date: "2020-10-04",
      lessonMinutes: 3,
      minutes: 5,
    });
  });

  it("uses genuine capacity across a calendar phase without changing the lesson's due phase or practice", () => {
    const long = {
      ...lesson({
        id: "long",
        portions: [
          { date: "2020-10-06", lessonMinutes: 2.5, minutes: 5 },
          { date: "2020-10-07", lessonMinutes: 2.5, minutes: 5 },
        ],
        position: 0,
      }),
      phase: 1,
    };

    const after = {
      ...lesson({
        id: "after",
        portions: [{ date: "2020-10-07", lessonMinutes: 2.5, minutes: 5 }],
        position: 1,
      }),
      phase: 1,
    };

    const boss = { ...event({ date: "2020-10-08", kind: "boss" }), phase: 1 };
    const mock = event({ date: "2020-10-04", kind: "mock" });

    const result = move(
      [long, after, boss, mock],
      [
        day({ date: "2020-10-04" }),
        day({ date: "2020-10-06", kind: "mock", phase: 1, share: 0.5 }),
        day({ date: "2020-10-07", phase: 1, share: 0.5 }),
        day({ date: "2020-10-08", kind: "boss", phase: 1, share: 0.5 }),
      ],
    );

    expect(result.items.find((item) => item.id === mock.id)?.scheduledFor).toStrictEqual(
      fromIsoDate("2020-10-06"),
    );

    expect(result.items.find((item) => item.id === long.id)).toMatchObject({
      minutes: 10,
      phase: 1,
      scheduledFor: long.scheduledFor,
    });

    expect(result.portions.get(getItemKey(long))).toStrictEqual([
      { date: "2020-10-04", lessonMinutes: 2.5, minutes: 5 },
      { date: "2020-10-07", lessonMinutes: 2.5, minutes: 5 },
    ]);
  });
});
