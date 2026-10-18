import { describe, expect, it } from "vitest";
import { getPlanInputsKey, readLanding } from "../_utils/plan-inputs-key";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { getItemKey } from "./plan-items";
import { parsePlanSettings } from "./plan-state";
import { listSelectedItemFacts } from "./selected-item-facts";

const TODAY = fromIsoDate("2026-09-30");

function lesson(lessonId: string, skillId: string) {
  return {
    chapterId: `chapter-${skillId}`,
    lessonId,
    minutes: 3,
    skillIds: [skillId],
    title: lessonId,
  };
}

function input(startDate = "2026-09-29"): BuildPlanInput {
  return {
    goal: { dailyMinutes: 30, kind: "learn", targetDate: fromIsoDate("2026-10-20") },
    graph: {
      phases: [{ milestone: null, name: "Only" }],
      skills: [
        { area: null, lessons: 3, name: "A", phase: 0, skillId: "A", weight: null },
        { area: null, lessons: 2, name: "B", phase: 0, skillId: "B", weight: null },
      ],
    },
    items: [],
    lessons: [
      lesson("a1", "A"),
      lesson("a2", "A"),
      lesson("a3", "A"),
      lesson("b1", "B"),
      lesson("b2", "B"),
    ],
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate }),
    today: fromIsoDate(startDate),
  };
}

function save(built: ReturnType<typeof buildPlan>, source?: BuildPlanInput) {
  const facts = source ? listSelectedItemFacts({ built, input: source }) : new Map();

  return built.items.map((item, position) => ({
    ...item,
    ...(source ? { facts: { ...facts.get(item.key), schemaVersion: 1 } } : {}),
    id: item.key,
    position,
  }));
}

function totalMinutes(entries: readonly { minutes: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.minutes, 0);
}

function onToday(built: ReturnType<typeof buildPlan>) {
  return [...built.lessonRawMinutes].flatMap(([key, days]) => {
    const minutes = days.get(toIsoDate(TODAY));
    return minutes && minutes > 0 ? [{ key, minutes }] : [];
  });
}

describe("shown-day membership", () => {
  it("holds only today's stand-in portion and keeps all of its future teaching available", () => {
    const base = input("2026-09-30");

    const original = {
      ...base,
      goal: { ...base.goal, dailyMinutes: 10 },
      lessons: [lesson("b1", "B"), lesson("b2", "B")],
    };

    const first = buildPlan(original);
    const current = { ...original, items: save(first), todayShown: true };
    const preview = buildPlan(current);
    const opened = buildPlan({ ...current, lessons: [...current.lessons, lesson("b3", "B")] });
    expect(onToday(opened)).toStrictEqual(onToday(preview));

    expect(
      [...(opened.lessonRawMinutes.get("skill:A")?.values() ?? [])].reduce(
        (sum, minutes) => sum + minutes,
        0,
      ),
    ).toBe(12);

    expect(
      opened.items.find((item) => item.lessonId === "b3")?.scheduledFor?.getTime(),
    ).toBeGreaterThan(TODAY.getTime());
  });

  it("preserves the actual interval of a held long lesson without double-charging tomorrow", () => {
    const base = input("2026-09-30");

    const original = {
      ...base,
      goal: { ...base.goal, dailyMinutes: 10 },
      lessons: base.lessons.map((entry) => ({
        ...entry,
        minutes: entry.lessonId === "a1" ? 18 : entry.minutes,
      })),
    };

    const first = buildPlan(original);
    const next = { ...original, items: save(first), todayShown: true };
    const preview = buildPlan(next);
    const opened = buildPlan({ ...next, lessons: [...next.lessons, lesson("a4", "A")] });
    expect(onToday(opened)).toStrictEqual(onToday(preview));

    expect(opened.lessonRawMinutes.get("lesson:a1")).toStrictEqual(
      preview.lessonRawMinutes.get("lesson:a1"),
    );

    expect(opened.teachingEnds.get("lesson:a1")).toStrictEqual(
      preview.teachingEnds.get("lesson:a1"),
    );

    expect(
      opened.items.find((item) => item.lessonId === "a4")?.scheduledFor?.getTime(),
    ).toBeGreaterThan(TODAY.getTime());
  });

  it("keeps an impossible shown lesson out without refilling its place", () => {
    const base = input("2026-09-30");
    const first = buildPlan(base);

    const opened = buildPlan({
      ...base,
      items: save(first, base),
      lessons: [...base.lessons.filter((entry) => entry.lessonId !== "a1"), lesson("a4", "A")],
      todayShown: true,
    });

    expect(onToday(opened)).toStrictEqual(
      onToday(first).filter((entry) => entry.key !== "lesson:a1"),
    );
  });

  it.each([false, true])(
    "removes only an unavailable shown lesson without refill (publication: %s)",
    (publication) => {
      const base = input("2026-09-30");
      const original = { ...base, goal: { ...base.goal, dailyMinutes: 10 } };
      const first = buildPlan(original);
      const preview = onToday(first);

      expect(preview).toStrictEqual([
        { key: "lesson:a1", minutes: 3 },
        { key: "lesson:a2", minutes: 2 },
      ]);

      const opened = buildPlan({
        ...original,
        items: save(first, original),
        lessons: [
          ...base.lessons.filter((entry) => entry.lessonId !== "a1"),
          ...(publication ? [lesson("a4", "A")] : []),
        ],
        todayShown: true,
      });

      expect(onToday(opened)).toStrictEqual(preview.filter((entry) => entry.key !== "lesson:a1"));
      expect(onToday(opened)).toHaveLength(1);
    },
  );

  it("leaves an unshown forced day free to select newly published teaching", () => {
    const base = input("2026-09-30");
    const first = buildPlan(base);

    const opened = buildPlan({
      ...base,
      items: save(first),
      lessons: [...base.lessons, lesson("a4", "A")],
      todayShown: false,
    });

    expect(onToday(opened).map((entry) => entry.key)).toContain("lesson:a4");
  });

  it("keeps the forced overdue preview's exact teaching when new content arrives", () => {
    const base = input();
    const first = buildPlan(base);
    const saved = save(first);

    const current = {
      ...base,
      items: saved,
      setAsideLeftWork: true,
      today: TODAY,
      todayShown: true,
    };

    const preview = buildPlan(current);
    const opened = buildPlan({ ...current, lessons: [...base.lessons, lesson("a4", "A")] });

    expect(onToday(preview).map((entry) => entry.key)).toStrictEqual([
      "lesson:a1",
      "lesson:a2",
      "lesson:a3",
      "lesson:b1",
      "lesson:b2",
    ]);

    expect(onToday(opened)).toStrictEqual(onToday(preview));

    expect(
      opened.items.find((item) => item.lessonId === "a4")?.scheduledFor?.getTime(),
    ).toBeGreaterThan(TODAY.getTime());
  });

  it("keeps the exact shown stand-in slice when its lesson lands during a forced stale run", () => {
    const base = input();

    const original: BuildPlanInput = {
      ...base,
      goal: { ...base.goal, dailyMinutes: 10 },
      graph: {
        ...base.graph,
        skills: [
          { area: null, lessons: 1, name: "B", phase: 0, skillId: "B", weight: null },
          { area: null, lessons: 3, name: "C", phase: 0, skillId: "C", weight: null },
          { area: null, lessons: 3, name: "D", phase: 0, skillId: "D", weight: null },
        ],
      },
      lessons: [lesson("b1", "B")],
    };

    const first = buildPlan(original);

    const current = {
      ...original,
      items: save(first),
      setAsideLeftWork: true,
      today: TODAY,
      todayShown: true,
    };

    const preview = buildPlan(current);

    expect(onToday(preview)).toStrictEqual([
      { key: "lesson:b1", minutes: 3 },
      { key: "skill:C", minutes: 2 },
    ]);

    const opened = buildPlan({ ...current, lessons: [...current.lessons, lesson("c1", "C")] });

    expect(onToday(opened)).toStrictEqual(onToday(preview));
    expect(onToday(opened)).toHaveLength(2);

    expect(opened.items.find((item) => item.key === "skill:C")).toMatchObject({
      lessonId: null,
      minutes: 4,
      scheduledFor: TODAY,
      skillId: "C",
      status: "todo",
    });

    expect(
      opened.items.find((item) => item.lessonId === "c1")?.scheduledFor?.getTime(),
    ).toBeGreaterThan(TODAY.getTime());

    expect(opened.lessonRawMinutes.get("skill:D")?.get(toIsoDate(TODAY))).toBeUndefined();
  });

  // An opened day said more lessons were on the way: once they land they take the time its
  // stand-in held there, after what the day showed, and never more than the day held.
  it("lands new written lessons in the time a shown stand-in held, keeping what the day showed", () => {
    const base = input("2026-09-30");

    const original = {
      ...base,
      graph: {
        ...base.graph,
        skills: [
          { area: null, lessons: 2, name: "B", phase: 0, skillId: "B", weight: null },
          { area: null, lessons: 4, name: "A", phase: 0, skillId: "A", weight: null },
        ],
      },
      lessons: [lesson("b1", "B"), lesson("b2", "B")],
    };

    const first = buildPlan(original);
    const saved = save(first);

    const next: BuildPlanInput = {
      ...original,
      items: saved,
      lessons: [...original.lessons, ...["a1", "a2", "a3", "a4"].map((id) => lesson(id, "A"))],
      mode: "automatic",
      todayShown: true,
    };

    const savedKey = getPlanInputsKey({
      input: { ...original, items: saved, mode: "automatic" },
      items: saved.map((item) => ({ key: getItemKey(item), status: item.status })),
    });

    const landing = readLanding({ input: next, savedKey });
    expect(landing).toMatchObject({ heldSkillsLand: true, landedOnly: true });
    const opened = buildPlan({ ...next, ...landing });
    const written = onToday(first).filter((entry) => entry.key.startsWith("lesson:"));

    expect(
      onToday(opened).filter((entry) => written.some((shown) => shown.key === entry.key)),
    ).toStrictEqual(written);

    expect(opened.items.find((item) => item.lessonId === "a1")?.scheduledFor).toStrictEqual(TODAY);

    // The day's lessons take no more time than it held: the stand-in they replaced holds none.
    const held = new Set(opened.items.map((item) => item.key));
    const lessonsToday = onToday(opened).filter((entry) => held.has(entry.key));
    expect(totalMinutes(lessonsToday)).toBeLessThanOrEqual(totalMinutes(onToday(first)));
  });
});
