import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { addDays, toIsoDate } from "../../plans/planner/plan-calendar";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { toBlockPayload } from "../../sessions/block-payload";
import { getChallengeTimings } from "./challenge-timing";

const TODAY = new Date("2026-11-09");

const boss = {
  facts: {
    boss: {
      kind: "text",
      minutes: 15,
      questions: 10,
      testedKeys: [],
      testedSkillIds: ["s"],
      waiting: false,
    },
    minutes: 15,
    parts: { checkpoint: 15, practice: 0, unwritten: 0, written: 0 },
    schemaVersion: 1,
    skillIds: [],
  },
  id: "a",
  kind: "boss" as const,
  minutes: 15,
  phase: 0,
  position: 1,
  scheduledFor: new Date("2026-11-20"),
  status: "todo" as const,
};

const base = {
  goal: { dailyMinutes: 20, kind: "learn" as const, targetDate: null },
  settings: parsePlanSettings({}),
  today: TODAY,
  todayBlocks: [],
};

function todayHolds(...planItemIds: string[]) {
  return planItemIds.map((planItemId) => ({
    payload: toBlockPayload({ planItemId }),
    status: "pending" as const,
  }));
}

describe(getChallengeTimings, () => {
  const lesson = {
    ...boss,
    facts: undefined,
    id: "lesson",
    kind: "lesson" as const,
    position: 2,
    scheduledFor: TODAY,
  };

  it("dates a challenge today's day leaves out for tomorrow", () => {
    const timings = getChallengeTimings({
      ...base,
      goal: { ...base.goal, dailyMinutes: 15 },
      items: [boss, lesson],
      todayBlocks: todayHolds("lesson"),
    });

    expect(timings.get("a")).toStrictEqual({ date: "2026-11-10", when: "date" });
  });

  it.each(["completed", "skipped"] as const)(
    "does not promise today's %s challenge again",
    (status) => {
      const timings = getChallengeTimings({
        ...base,
        items: [{ ...boss, scheduledFor: new Date("2026-11-08") }],
        todayBlocks: [{ payload: toBlockPayload({ planItemId: "a" }), status }],
      });

      expect(timings.get("a")).toStrictEqual({ date: "2026-11-10", when: "date" });
    },
  );

  it.each(["pending", "active"] as const)("keeps today's %s challenge in the session", (status) => {
    const timings = getChallengeTimings({
      ...base,
      items: [boss],
      todayBlocks: [{ payload: toBlockPayload({ planItemId: "a" }), status }],
    });

    expect(timings.get("a")).toStrictEqual({ date: "2026-11-09", when: "nextSession" });
  });

  it("does not promise a challenge lost earlier today for the next session", () => {
    const timings = getChallengeTimings({
      ...base,
      items: [{ ...boss, scheduledFor: new Date("2026-11-08") }],
      results: new Map([
        [
          "a",
          {
            correct: 3,
            localDate: TODAY,
            passed: false,
            studySessionBlockId: "b",
            studySessionId: "s",
            total: 10,
          },
        ],
      ]),
      todayBlocks: [{ payload: toBlockPayload({ planItemId: "a" }), status: "completed" }],
    });

    expect(timings.get("a")).toStrictEqual({ date: "2026-11-10", when: "date" });
  });

  it("dates a challenge lost today after the first duel the next day holds", () => {
    const timings = getChallengeTimings({
      ...base,
      items: [boss, { ...boss, id: "b", phase: 1, position: 2 }],
      results: new Map([
        [
          "a",
          {
            correct: 3,
            localDate: TODAY,
            passed: false,
            studySessionBlockId: "block",
            studySessionId: "session",
            total: 10,
          },
        ],
      ]),
      todayBlocks: [{ payload: toBlockPayload({ planItemId: "a" }), status: "completed" }],
    });

    expect(timings.get("a")).toStrictEqual({ date: "2026-11-11", when: "date" });
    expect(timings.get("b")).toStrictEqual({ date: "2026-11-10", when: "date" });
  });

  it("spends no later day's room on a legacy or empty challenge", () => {
    const items = [
      { ...boss, facts: null },
      {
        ...boss,
        facts: { ...boss.facts, boss: { ...boss.facts.boss, testedSkillIds: [] } },
        id: "empty",
        position: 2,
      },
      { ...boss, id: "c", position: 3 },
    ];

    expect(
      [...getChallengeTimings({ ...base, items }).values()].map((entry) => entry.date),
    ).toStrictEqual(["2026-11-10", "2026-11-10", "2026-11-10"]);
  });

  it("keeps an unreached challenge's saved estimate", () => {
    const timings = getChallengeTimings({
      ...base,
      items: [{ ...boss, id: "lesson", kind: "lesson", position: 0 }, boss],
    });

    expect(timings.get("a")).toStrictEqual({ date: "2026-11-20", when: "date" });
  });

  it("promises today every challenge today's day holds, and dates the rest from tomorrow", () => {
    const timings = getChallengeTimings({
      ...base,
      items: [boss, { ...boss, id: "b", position: 2 }, { ...boss, id: "c", position: 3 }],
      todayBlocks: todayHolds("b", "c"),
    });

    expect([...timings]).toStrictEqual([
      ["a", { date: "2026-11-10", when: "date" }],
      ["b", { date: "2026-11-09", when: "nextSession" }],
      ["c", { date: "2026-11-09", when: "nextSession" }],
    ]);
  });

  it("dates the second reached challenge on a day that can hold it", () => {
    const items = [boss, { ...boss, id: "b", phase: 1, position: 2 }];

    const timings = getChallengeTimings({ ...base, items });

    expect(timings.get("a")).toStrictEqual({ date: "2026-11-10", when: "date" });
    expect(timings.get("b")).toStrictEqual({ date: "2026-11-11", when: "date" });
  });

  it("dates first duels before rematches, in plan order within each", () => {
    const timings = getChallengeTimings({
      ...base,
      items: [boss, { ...boss, id: "b", position: 2 }, { ...boss, id: "c", position: 3 }],
      results: new Map([
        [
          "a",
          {
            correct: 3,
            localDate: new Date("2026-11-08"),
            passed: false,
            studySessionBlockId: "block",
            studySessionId: "session",
            total: 10,
          },
        ],
      ]),
    });

    expect(timings.get("b")?.date).toBe("2026-11-10");
    expect(timings.get("c")?.date).toBe("2026-11-11");
    expect(timings.get("a")?.date).toBe("2026-11-12");
  });

  it("does not spend tomorrow's room on a challenge already in today's session", () => {
    const timings = getChallengeTimings({
      ...base,
      items: [boss, { ...boss, id: "b", position: 2 }],
      todayBlocks: todayHolds("a"),
    });

    expect(timings.get("a")).toStrictEqual({ date: "2026-11-09", when: "nextSession" });
    expect(timings.get("b")).toStrictEqual({ date: "2026-11-10", when: "date" });
  });

  it("spends only capable days after skipping a mock, a review and rest days", () => {
    const timings = getChallengeTimings({
      ...base,
      goal: { ...base.goal, kind: "exam", targetDate: new Date("2026-12-01") },
      items: [
        boss,
        { ...boss, id: "b", position: 2 },
        { ...boss, id: "mock", kind: "mock", position: 3, scheduledFor: new Date("2026-11-10") },
        {
          ...boss,
          id: "review",
          kind: "review",
          position: 4,
          scheduledFor: new Date("2026-11-11"),
        },
      ],
      settings: parsePlanSettings({ weekdayMinutes: [0, 20, 20, 20, 20, 0, 0] }),
    });

    expect(timings.get("a")?.date).toBe("2026-11-12");
    expect(timings.get("b")?.date).toBe("2026-11-16");
  });

  it("dates challenges beyond the first week when only one day a week can hold them", () => {
    const items = Array.from({ length: 3 }, (_, index) => ({
      ...boss,
      id: String(index),
      position: index,
    }));

    const timings = getChallengeTimings({
      ...base,
      items,
      settings: parsePlanSettings({ weekdayMinutes: [0, 20, 0, 0, 0, 0, 0] }),
    });

    expect([...timings.values()].map((timing) => timing.date)).toStrictEqual([
      "2026-11-16",
      "2026-11-23",
      "2026-11-30",
    ]);
  });

  it("dates every reached challenge within the daily room, allowing one oversized challenge alone", () => {
    fc.assert(
      fc.property(
        fc.integer({ max: 20, min: 1 }),
        fc.integer({ max: 120, min: 1 }),
        fc.integer({ max: 90, min: 1 }),
        fc.boolean(),
        (count, budget, minutes, reversed) => {
          const items = Array.from({ length: count }, (_, position) => ({
            ...boss,
            facts: { ...boss.facts, boss: { ...boss.facts.boss, minutes } },
            id: String(position),
            position,
          }));

          const timings = getChallengeTimings({
            ...base,
            goal: { ...base.goal, dailyMinutes: budget },
            items: reversed ? items.toReversed() : items,
          });

          const perDay = Math.max(1, Math.floor(budget / minutes));

          for (const item of items) {
            expect(timings.get(item.id)).toStrictEqual({
              date: toIsoDate(addDays(TODAY, 1 + Math.floor(item.position / perDay))),
              when: "date",
            });
          }
        },
      ),
    );
  });

  it("dates a reached locked challenge from the next capable day, ignoring its saved estimate", () => {
    const timings = getChallengeTimings({ ...base, items: [boss] });

    expect(timings.get("a")).toStrictEqual({ date: "2026-11-10", when: "date" });
  });

  it("clamps a past estimate to tomorrow unless today's day holds it", () => {
    const items = [{ ...boss, scheduledFor: new Date("2026-11-01") }];

    expect(getChallengeTimings({ ...base, items }).get("a")).toStrictEqual({
      date: "2026-11-10",
      when: "date",
    });

    expect(
      getChallengeTimings({ ...base, items, todayBlocks: todayHolds("a") }).get("a"),
    ).toStrictEqual({ date: "2026-11-09", when: "nextSession" });
  });

  it.each(["2026-11-01", "2026-11-20"])(
    "uses the next capable date when the next study day is mock-only (estimate %s)",
    (estimate) => {
      const timings = getChallengeTimings({
        ...base,
        goal: { ...base.goal, kind: "exam", targetDate: new Date("2026-12-01") },
        items: [
          { ...boss, scheduledFor: new Date(estimate) },
          { ...boss, id: "mock", kind: "mock", position: 2, scheduledFor: new Date("2026-11-10") },
        ],
        settings: parsePlanSettings({
          startDate: "2026-11-01",
          weekdayMinutes: [0, 0, 20, 20, 20, 20, 0],
        }),
      });

      expect(timings.get("a")).toStrictEqual({ date: "2026-11-11", when: "date" });
    },
  );
});
