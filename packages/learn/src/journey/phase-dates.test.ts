import { describe, expect, it } from "vitest";
import { getAxisDatedPhases, getPhaseEnd, getRoadmapFinish } from "./phase-dates";

type Phase = Parameters<typeof getPhaseEnd>[0]["phase"];
type Plan = Parameters<typeof getPhaseEnd>[0]["plan"];

const TODAY = "2026-11-15";

const EXAM_DAY = {
  targetDate: "2027-11-14",
  targetDateEstimated: true,
  targetDateNamedMonth: false,
};

function phase(index: number, attrs: Partial<Phase> = {}): Phase {
  return {
    checkpoint: null,
    endDate: null,
    index,
    kind: "learn",
    short: null,
    state: "upcoming",
    ...attrs,
  };
}

function plan(phases: Phase[], attrs: Partial<Plan> = {}): Plan {
  return {
    estimate: { endDate: null },
    phases,
    schedule: { targetDate: null, targetDateEstimated: false, targetDateNamedMonth: false },
    shortPlan: null,
    week: { startDate: TODAY },
    ...attrs,
  };
}

/** Three phases ending on these days, the first under way unless the states say otherwise. */
function threePhases(ends: [string, string, string], states: Phase["state"][] = []): Plan {
  return plan(
    ends.map((endDate, index) =>
      phase(index, { endDate, state: states[index] ?? (index === 0 ? "current" : "upcoming") }),
    ),
  );
}

type GoalKind = Parameters<typeof getAxisDatedPhases>[0]["goalKind"];

function axis(
  shaped: Plan,
  { goalKind = "learn", today = TODAY }: { goalKind?: GoalKind; today?: string } = {},
): number[] {
  return [...getAxisDatedPhases({ goalKind, plan: shaped, today })];
}

describe(getPhaseEnd, () => {
  it("names a phase by the day it ends, with no estimate once it's under way", () => {
    const current = phase(0, { endDate: "2026-11-20", kind: "foundations", state: "current" });
    const end = getPhaseEnd({ phase: current, plan: plan([current]) });
    expect(end).toStrictEqual({ estimate: false, isoDate: "2026-11-20", month: false });
  });

  it("gives a finished phase no date", () => {
    const done = phase(0, { endDate: "2026-11-01", state: "done" });
    expect(getPhaseEnd({ phase: done, plan: plan([done]) })).toBeNull();
  });

  it("marks a learning phase ahead as an estimate", () => {
    const ahead = phase(1, { endDate: "2026-12-01" });
    const end = getPhaseEnd({ phase: ahead, plan: plan([phase(0), ahead]) });
    expect(end).toStrictEqual({ estimate: true, isoDate: "2026-12-01", month: false });
  });

  it("says a far estimate by its month, in the next calendar year too", () => {
    const ahead = phase(1, { endDate: "2027-03-10" });
    const end = getPhaseEnd({ phase: ahead, plan: plan([phase(0), ahead]) });
    expect(end).toStrictEqual({ estimate: true, isoDate: "2027-03-10", month: true });
  });

  it("ends a phase on its challenge's day when that comes after its last lesson", () => {
    const checkpoint = {
      date: "2026-11-22",
      locked: false,
      planItemId: null,
      state: "upcoming" as const,
      when: "date" as const,
    };

    const current = phase(0, { checkpoint, endDate: "2026-11-20", state: "current" });
    const end = getPhaseEnd({ phase: current, plan: plan([current]) });
    expect(end).toStrictEqual({ estimate: true, isoDate: "2026-11-22", month: false });
  });

  it("ends the last phase without a day of its own with the plan", () => {
    const last = phase(0, { state: "current" });
    const shaped = plan([last], { estimate: { endDate: "2026-12-12" } });
    const end = getPhaseEnd({ phase: last, plan: shaped });
    expect(end).toStrictEqual({ estimate: true, isoDate: "2026-12-12", month: false });
  });

  it("gives a phase still being planned no date", () => {
    const building = phase(0);
    expect(getPhaseEnd({ phase: building, plan: plan([building, phase(1)]) })).toBeNull();
  });
});

describe(getRoadmapFinish, () => {
  it("is the exam's date, an estimate when the date is", () => {
    const shaped = plan([phase(0)], { schedule: EXAM_DAY });
    const finish = getRoadmapFinish({ goalKind: "exam", plan: shaped });
    expect(finish).toStrictEqual({ estimate: true, isoDate: "2027-11-14", month: false });
  });

  it("is the plan's own end, about, when the learner set no date", () => {
    const shaped = plan([phase(0)], { estimate: { endDate: "2026-12-12" } });
    const finish = getRoadmapFinish({ goalKind: "learn", plan: shaped });
    expect(finish).toStrictEqual({ estimate: true, isoDate: "2026-12-12", month: false });
  });

  it("is none for an exam without a date", () => {
    const shaped = plan([phase(0)], { estimate: { endDate: "2026-12-12" } });
    expect(getRoadmapFinish({ goalKind: "exam", plan: shaped })).toBeNull();
  });
});

describe(getAxisDatedPhases, () => {
  it("dates the current phase and each after it, but not the last", () => {
    expect(axis(threePhases(["2026-11-20", "2026-12-01", "2026-12-10"]))).toStrictEqual([0, 1]);
  });

  it("dates a day once when two phases end on it", () => {
    expect(axis(threePhases(["2026-11-20", "2026-11-20", "2026-12-01"]))).toStrictEqual([1]);
  });

  it("leaves no date for a finished phase", () => {
    const shaped = threePhases(["2026-11-10", "2026-11-20", "2026-12-01"], ["done", "current"]);
    expect(axis(shaped)).toStrictEqual([1]);
  });

  it("leaves the current phase ending today to Today, on the learner's day, not UTC's", () => {
    const learnersDay = "2026-11-16";
    const shaped = threePhases([learnersDay, "2026-11-25", "2026-12-01"]);
    expect(axis(shaped, { today: learnersDay })).toStrictEqual([1]);
    expect(axis(shaped, { today: TODAY })).toStrictEqual([0, 1]);
  });

  it("leaves a phase ending on the goal's day to the goal's date", () => {
    const shaped = plan(
      [
        phase(0, { endDate: "2026-11-20", state: "current" }),
        phase(1, { endDate: "2027-11-14" }),
        phase(2, { endDate: "2027-11-14" }),
      ],
      { schedule: EXAM_DAY },
    );

    expect(axis(shaped, { goalKind: "exam" })).toStrictEqual([0]);
  });

  it("dates nothing on a one-phase plan, whose end is the goal's", () => {
    expect(axis(plan([phase(0, { endDate: "2026-12-01", state: "current" })]))).toStrictEqual([]);
  });

  it("dates nothing while no phase is under way", () => {
    const shaped = threePhases(["2026-11-20", "2026-12-01", "2026-12-10"], ["upcoming"]);
    expect(axis(shaped)).toStrictEqual([]);
  });
});
