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
  // A plan short on time had no room for a phase's challenge, so the phase ended on its weekly
  // challenge's day. Kept as if its challenge were there, the next run brought the challenge in on
  // that day and pushed a lesson out, and the run after that, with no room there, left it out again.
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

  // Today has 8 minutes of lessons left, after what the day before left came first.
  const days: PlanDay[] = [16, 60, 60].map((minutes, offset) => ({
    date: addDays(today, offset),
    shape: { events: [], minutes, open: true, phase: 0, share: 0.5 },
  }));

  /*
   * A half-studied day left the first phase's challenge undone, and the second phase's end was
   * today: pinned there, its challenge went before the first's, ahead of every lesson of its own
   * phase, and the next refresh laid the week out again a day later. Today's 8 minutes don't hold
   * both challenges: they stay on the day the learner saw all the same (R6), and Today offers to
   * move the dates.
   */
  it("never puts a phase's challenge before an earlier phase's challenge still to do", () => {
    const units = [
      unit({ key: "boss:0", kind: "boss", minutes: 5, phase: 0 }),
      unit({ key: "lesson:a", kind: "lesson", minutes: 6, phase: 1 }),
      unit({ key: "lesson:b", kind: "lesson", minutes: 6, phase: 1 }),
      unit({ key: "boss:1", kind: "boss", minutes: 5, phase: 1 }),
    ];

    const ends = new Map([[1, today]]);
    const scheduled = scheduleUnits({ days, units: keepPhaseEnds({ days, ends, units }) });

    // Held on its end, phase 1's challenge would test lessons a and b before they're taught: the
    // end isn't kept (see `keepPhaseEnd`), and it comes the study day after them, after phase 0's.
    expect(scheduled.units.map((entry) => [entry.key, toIsoDate(entry.date)])).toStrictEqual([
      ["boss:0", "2026-10-27"],
      ["lesson:a", "2026-10-28"],
      ["lesson:b", "2026-10-28"],
      ["boss:1", "2026-10-29"],
    ]);

    // Not kept, it strains no end; its move is told as one before its lessons (`listEndsBeforeLessons`).
    expect(listStrainedEnds({ days, ends, units: scheduled.units })).toStrictEqual([]);
  });

  // A missed day left two earlier phases' challenges undone (career 1027, R39): only the last of
  // them came before the kept end's challenge, and the other ended its phase after it.
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

    // Still in phase order, each after the lessons it tests: phase 2's, with no study day left after
    // lesson b, right after it on the last day (see `placeBoss`).
    expect(scheduled.units.map((entry) => [entry.key, toIsoDate(entry.date)])).toStrictEqual([
      ["boss:0", "2026-10-27"],
      ["lesson:a", "2026-10-28"],
      ["boss:1", "2026-10-29"],
      ["lesson:b", "2026-10-29"],
      ["boss:2", "2026-10-29"],
    ]);
  });

  // r13-rules (R6, 10 Oct): a half-studied day is studied; the challenge it left comes first, the
  // next one still closes its phase on the day the learner saw, and the phase's lessons give way.
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

    // The half-studied day's challenge first; its own after the lessons it tests, not held before them.
    expect(scheduled.units.map((entry) => [entry.key, toIsoDate(entry.date)])).toStrictEqual([
      ["boss:0", "2026-10-27"],
      ["lesson:a", "2026-10-28"],
      ["lesson:b", "2026-10-28"],
      ["boss:1", "2026-10-29"],
    ]);
  });

  // A shown end never moves without the learner (R6): on a day the learner gives no time, the
  // phase's challenge stays all the same, and Today offers to move the dates.
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

  // A challenge held on a day the learner rests takes no time from the days around it. Started in
  // the day before's time, it pushed that day's lessons after it, past the challenge that tests
  // them (R40), and the day before showed nothing to study.
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

  // A unit is due on the day it ends, with all its minutes: a skill not outlined yet (one stand-in
  // of weeks of lessons) ending on Maya's last kept end read as a day without room for its
  // challenge, and Today offered to move it. Only challenges strain a day; lessons give way.
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

/** A lesson the plan files under the second phase's time. */
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

  // The plan files a phase's lessons that come after its end under the next phase's time: read by
  // the phase their skill has, they were never seen as coming after its challenge (language seed 1,
  // a lesson kept with the week).
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
