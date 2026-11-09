import { describe, expect, it } from "vitest";
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
};

describe(getChallengeTimings, () => {
  it.each(["completed", "skipped"] as const)(
    "does not promise today's %s challenge again",
    (status) => {
      const timings = getChallengeTimings({
        ...base,
        items: [{ ...boss, scheduledFor: new Date("2026-11-08") }],
        savedDay: true,
        todayBlocks: [{ payload: toBlockPayload({ planItemId: "a" }), status }],
      });

      expect(timings.get("a")).toStrictEqual({ date: "2026-11-10", when: "date" });
    },
  );

  it.each(["pending", "active"] as const)("keeps today's %s challenge in the session", (status) => {
    const timings = getChallengeTimings({
      ...base,
      items: [boss],
      savedDay: true,
      todayBlocks: [{ payload: toBlockPayload({ planItemId: "a" }), status }],
    });

    expect(timings.get("a")).toStrictEqual({ date: "2026-11-09", when: "nextSession" });
  });

  it.each(["2026-11-08", "2026-11-09"])(
    "holds reached challenges until after a planned review due on %s",
    (date) => {
      const timings = getChallengeTimings({
        ...base,
        items: [
          boss,
          { ...boss, id: "review", kind: "review", position: 2, scheduledFor: new Date(date) },
        ],
      });

      expect(timings.get("a")).toStrictEqual({ date: "2026-11-10", when: "date" });
    },
  );

  it("does not reserve today for a finished past review", () => {
    const timings = getChallengeTimings({
      ...base,
      items: [
        boss,
        {
          ...boss,
          id: "review",
          kind: "review",
          position: 2,
          scheduledFor: new Date("2026-11-08"),
          status: "done",
        },
      ],
    });

    expect(timings.get("a")?.when).toBe("nextSession");
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
      savedDay: true,
      todayBlocks: [{ payload: toBlockPayload({ planItemId: "a" }), status: "completed" }],
    });

    expect(timings.get("a")).toStrictEqual({ date: "2026-11-10", when: "date" });
  });

  it("offers a reached challenge before its estimate and never queues a later one", () => {
    const timings = getChallengeTimings({
      ...base,
      goal: { ...base.goal, dailyMinutes: 30 },
      items: [boss, { ...boss, id: "b", position: 2 }],
    });

    expect([...timings.values()].map((entry) => entry.when)).toStrictEqual([
      "nextSession",
      "nextSession",
    ]);
  });

  it("does not promise a legacy or empty challenge before a day build can establish its offer", () => {
    const items = [
      { ...boss, facts: null },
      {
        ...boss,
        facts: { ...boss.facts, boss: { ...boss.facts.boss, testedSkillIds: [] } },
        id: "empty",
        position: 2,
      },
    ];

    expect(
      [...getChallengeTimings({ ...base, items }).values()].map((entry) => entry.when),
    ).toStrictEqual(["date", "date"]);
  });

  it("waits for todo teaching before its position, including lessons due today", () => {
    const timings = getChallengeTimings({
      ...base,
      items: [{ ...boss, id: "lesson", kind: "lesson", position: 0 }, boss],
    });

    expect(timings.get("a")?.when).toBe("date");
  });

  it("does not promise an unfunded challenge in the next session", () => {
    const timings = getChallengeTimings({
      ...base,
      items: [boss, { ...boss, id: "b", position: 2 }],
    });

    expect(timings.get("a")?.when).toBe("nextSession");
    expect(timings.get("b")?.when).toBe("date");
    expect(timings.get("b")?.date).toBe("2026-11-10");
  });

  it("dates a reached locked challenge from the next capable day, ignoring its saved estimate", () => {
    const timings = getChallengeTimings({ ...base, items: [boss], savedDay: true });

    expect(timings.get("a")).toStrictEqual({ date: "2026-11-10", when: "date" });
  });

  it("clamps a past estimate to tomorrow unless today's saved session holds it", () => {
    const items = [{ ...boss, scheduledFor: new Date("2026-11-01") }];

    expect(getChallengeTimings({ ...base, items, savedDay: true }).get("a")).toStrictEqual({
      date: "2026-11-10",
      when: "date",
    });

    expect(
      getChallengeTimings({
        ...base,
        items,
        savedDay: true,
        todayBlocks: [{ payload: toBlockPayload({ planItemId: "a" }), status: "pending" }],
      }).get("a"),
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
