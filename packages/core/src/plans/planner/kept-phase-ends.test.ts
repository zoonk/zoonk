import { describe, expect, it } from "vitest";
import {
  getShownPhaseEnds,
  keepPhaseEnds,
  listEndsBeforeLessons,
  listStrainedEnds,
} from "./kept-phase-ends";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem } from "./plan-items";
import { type PlanPhase } from "./plan-state";
import { type QueueUnit } from "./plan-units";
import { type PlanDay, scheduleUnits } from "./schedule-units";

function phase(startDate: string | null, endDate: string | null): PlanPhase {
  return { endDate, kind: "learn", milestone: null, minutes: 0, name: "Phase", startDate };
}

function item(attrs: Partial<ExistingPlanItem> & Pick<ExistingPlanItem, "id">): ExistingPlanItem {
  return {
    chapterId: null,
    completedAt: null,
    kind: "lesson",
    lessonId: null,
    phase: 0,
    position: 0,
    scheduledFor: null,
    skillId: null,
    status: "todo",
    titleSnapshot: "Item",
    ...attrs,
  };
}

describe(getShownPhaseEnds, () => {
  it("keeps the end of each phase whose challenge the plan shows on it, and no other", () => {
    const phases = [
      phase("2026-10-12", "2026-10-13"),
      phase("2026-10-14", "2026-12-06"),
      phase(null, null),
    ];

    const items = [
      item({ id: "boss-0", kind: "boss", phase: 0, scheduledFor: fromIsoDate("2026-10-13") }),
      item({ id: "week", kind: "checkpoint", phase: 1, scheduledFor: fromIsoDate("2026-12-06") }),
    ];

    expect(getShownPhaseEnds({ items, phases })).toStrictEqual(
      new Map([[0, fromIsoDate("2026-10-13")]]),
    );
  });
});

function unit(attrs: Pick<QueueUnit, "key" | "kind" | "minutes" | "phase">): QueueUnit {
  return { area: "UX", chapterId: null, lessonId: null, skillId: null, title: attrs.key, ...attrs };
}

describe(keepPhaseEnds, () => {
  const today = fromIsoDate("2026-10-27");

  const days: PlanDay[] = [16, 60, 60].map((minutes, offset) => ({
    date: addDays(today, offset),
    shape: { events: [], minutes, open: true, phase: 0, share: 0.5 },
  }));

  it("never puts a phase's challenge before an earlier phase's challenge still to do", () => {
    const units = [
      unit({ key: "boss:0", kind: "boss", minutes: 5, phase: 0 }),
      unit({ key: "lesson:a", kind: "lesson", minutes: 6, phase: 1 }),
      unit({ key: "lesson:b", kind: "lesson", minutes: 6, phase: 1 }),
      unit({ key: "boss:1", kind: "boss", minutes: 5, phase: 1 }),
    ];

    const ends = new Map([[1, today]]);
    const scheduled = scheduleUnits({ days, units: keepPhaseEnds({ days, ends, units }) });

    expect(scheduled.units.map((entry) => [entry.key, toIsoDate(entry.date)])).toStrictEqual([
      ["boss:0", "2026-10-27"],
      ["lesson:a", "2026-10-28"],
      ["lesson:b", "2026-10-28"],
      ["boss:1", "2026-10-29"],
    ]);

    expect(listStrainedEnds({ days, ends, units: scheduled.units })).toStrictEqual([]);
  });

  it("puts every earlier challenge still to do before a kept end's, in phase order", () => {
    const units = [
      unit({ key: "boss:0", kind: "boss", minutes: 5, phase: 0 }),
      unit({ key: "lesson:a", kind: "lesson", minutes: 6, phase: 1 }),
      unit({ key: "boss:1", kind: "boss", minutes: 5, phase: 1 }),
      unit({ key: "lesson:b", kind: "lesson", minutes: 6, phase: 2 }),
      unit({ key: "boss:2", kind: "boss", minutes: 5, phase: 2 }),
    ];

    const ends = new Map([[2, today]]);
    const scheduled = scheduleUnits({ days, units: keepPhaseEnds({ days, ends, units }) });

    expect(scheduled.units.map((entry) => [entry.key, toIsoDate(entry.date)])).toStrictEqual([
      ["boss:0", "2026-10-27"],
      ["lesson:a", "2026-10-28"],
      ["boss:1", "2026-10-29"],
      ["lesson:b", "2026-10-29"],
      ["boss:2", "2026-10-29"],
    ]);
  });

  it("keeps a phase's end with the challenge a half-studied day left right before its own", () => {
    const roomy = days.map((day, offset) =>
      offset === 0 ? { ...day, shape: { ...day.shape, minutes: 20 } } : day,
    );

    const units = [
      unit({ key: "boss:0", kind: "boss", minutes: 5, phase: 0 }),
      unit({ key: "lesson:a", kind: "lesson", minutes: 6, phase: 1 }),
      unit({ key: "lesson:b", kind: "lesson", minutes: 6, phase: 1 }),
      unit({ key: "boss:1", kind: "boss", minutes: 5, phase: 1 }),
    ];

    const kept = keepPhaseEnds({ days: roomy, ends: new Map([[1, today]]), units });
    const scheduled = scheduleUnits({ days: roomy, units: kept });

    expect(scheduled.units.map((entry) => [entry.key, toIsoDate(entry.date)])).toStrictEqual([
      ["boss:0", "2026-10-27"],
      ["lesson:a", "2026-10-28"],
      ["lesson:b", "2026-10-28"],
      ["boss:1", "2026-10-29"],
    ]);
  });

  it("keeps a phase's challenge on its end day when that day has no study time", () => {
    const resting = [60, 0, 60].map((minutes, offset) => ({
      date: addDays(today, offset),
      shape: { events: [], minutes, open: true, phase: null, share: 0.5 },
    }));

    const units = [
      unit({ key: "lesson:a", kind: "lesson", minutes: 6, phase: 0 }),
      unit({ key: "lesson:b", kind: "lesson", minutes: 6, phase: 0 }),
      unit({ key: "boss:0", kind: "boss", minutes: 5, phase: 0 }),
      unit({ key: "lesson:c", kind: "lesson", minutes: 6, phase: 1 }),
    ];

    const ends = new Map([[0, addDays(today, 1)]]);

    const scheduled = scheduleUnits({
      days: resting,
      units: keepPhaseEnds({ days: resting, ends, units }),
    });

    expect(scheduled.units.map((entry) => [entry.key, toIsoDate(entry.date)])).toStrictEqual([
      ["lesson:a", "2026-10-27"],
      ["lesson:b", "2026-10-27"],
      ["boss:0", "2026-10-28"],
      ["lesson:c", "2026-10-29"],
    ]);

    expect(listStrainedEnds({ days: resting, ends, units: scheduled.units })).toStrictEqual([
      { phase: 0, resting: true, room: "2026-10-29" },
    ]);
  });

  it("keeps the lessons of the days around a challenge held on a day the learner rests", () => {
    const tight = [12, 12, 0, 12].map((minutes, offset) => ({
      date: addDays(today, offset),
      shape: { events: [], minutes, open: true, phase: null, share: 1 },
    }));

    const units = [
      unit({ key: "lesson:a", kind: "lesson", minutes: 6, phase: 0 }),
      unit({ key: "lesson:b", kind: "lesson", minutes: 6, phase: 0 }),
      unit({ key: "lesson:c", kind: "lesson", minutes: 6, phase: 0 }),
      unit({ key: "lesson:d", kind: "lesson", minutes: 6, phase: 0 }),
      unit({ key: "boss:0", kind: "boss", minutes: 10, phase: 0 }),
      unit({ key: "lesson:e", kind: "lesson", minutes: 6, phase: 1 }),
      unit({ key: "lesson:f", kind: "lesson", minutes: 6, phase: 1 }),
    ];

    const ends = new Map([[0, addDays(today, 2)]]);

    const scheduled = scheduleUnits({
      days: tight,
      units: keepPhaseEnds({ days: tight, ends, units }),
    });

    expect(scheduled.units.map((entry) => [entry.key, toIsoDate(entry.date)])).toStrictEqual([
      ["lesson:a", "2026-10-27"],
      ["lesson:b", "2026-10-27"],
      ["lesson:c", "2026-10-28"],
      ["lesson:d", "2026-10-28"],
      ["boss:0", "2026-10-29"],
      ["lesson:e", "2026-10-30"],
      ["lesson:f", "2026-10-30"],
    ]);
  });

  it("never counts a lesson studied over the days before as straining a phase's end", () => {
    const units = [
      unit({ key: "lesson:a", kind: "lesson", minutes: 4, phase: 0 }),
      unit({ key: "lesson:b", kind: "lesson", minutes: 28, phase: 0 }),
      unit({ key: "boss:0", kind: "boss", minutes: 5, phase: 0 }),
    ];

    const ends = new Map([[0, addDays(today, 1)]]);
    const scheduled = scheduleUnits({ days, units: keepPhaseEnds({ days, ends, units }) });

    expect(listStrainedEnds({ days, ends, units: scheduled.units })).toStrictEqual([]);
  });
});

function filed(key: string, skillId: string, date: string) {
  return {
    key,
    kind: "lesson" as const,
    phase: 1,
    scheduledFor: fromIsoDate(date),
    skillId,
    status: "todo" as const,
  };
}

describe(listEndsBeforeLessons, () => {
  const end = fromIsoDate("2026-10-18");
  const ends = new Map([[0, end]]);

  const input = {
    graph: {
      phases: [],
      skills: [
        { phase: 0, skillId: "arrival" },
        { phase: 1, skillId: "renting" },
      ],
    },
  } as unknown as Parameters<typeof listEndsBeforeLessons>[0]["input"];

  it("reads a lesson filed under the next phase by its own skill's phase", () => {
    const items = [filed("a", "arrival", "2026-10-19"), filed("b", "renting", "2026-10-20")];

    expect(
      listEndsBeforeLessons({ ends, input, items, units: [{ depth: false, key: "a" }] }),
    ).toStrictEqual([0]);
  });

  it("lets depth a plan short on time studies later come after the challenge", () => {
    const items = [filed("a", "arrival", "2026-10-19"), filed("b", "renting", "2026-10-20")];

    expect(
      listEndsBeforeLessons({ ends, input, items, units: [{ depth: true, key: "a" }] }),
    ).toStrictEqual([]);
  });
});
