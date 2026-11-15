import { describe, expect, it } from "vitest";
import {
  getAxisDatedPhases,
  getAxisFinish,
  getPhaseEnd,
  getRoadmapFinish,
  getRoadmapPhases,
} from "./phase-dates";

type Phase = Parameters<typeof getPhaseEnd>[0]["phase"];
type Plan = Parameters<typeof getPhaseEnd>[0]["plan"];

const TODAY = "2026-11-15";

const CHALLENGE = {
  date: "2026-11-22",
  locked: false,
  planItemId: null,
  state: "upcoming" as const,
  when: "date" as const,
};

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

function shortDays(firstDay: number, lastDay: number): NonNullable<Phase["short"]> {
  return { firstDay, focus: "practice", lastDay };
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
    const current = phase(0, { checkpoint: CHALLENGE, endDate: "2026-11-20", state: "current" });
    const end = getPhaseEnd({ phase: current, plan: plan([current]) });
    expect(end).toStrictEqual({ estimate: true, isoDate: "2026-11-22", month: false });
  });

  it("ends the last phase without a day of its own with the plan", () => {
    const last = phase(0, { state: "current" });
    const shaped = plan([last], { estimate: { endDate: "2026-12-12" } });
    const end = getPhaseEnd({ phase: last, plan: shaped });
    expect(end).toStrictEqual({ estimate: true, isoDate: "2026-12-12", month: false });
  });

  it("says an estimate by its day up to 42 days from the plan's week, by its month after", () => {
    const at42 = phase(1, { endDate: "2026-12-27" });
    const at43 = phase(1, { endDate: "2026-12-28" });
    const near = getPhaseEnd({ phase: at42, plan: plan([phase(0), at42]) });
    const far = getPhaseEnd({ phase: at43, plan: plan([phase(0), at43]) });
    expect(near).toMatchObject({ month: false });
    expect(far).toMatchObject({ month: true });
  });

  it("gives a phase the learner didn't finish, or one left out, no date", () => {
    const unfinished = phase(0, { endDate: "2026-11-10", state: "unfinished" });
    const leftOut = phase(1, { endDate: "2026-11-20", state: "leftOut" });
    const shaped = plan([unfinished, leftOut]);
    expect(getPhaseEnd({ phase: unfinished, plan: shaped })).toBeNull();
    expect(getPhaseEnd({ phase: leftOut, plan: shaped })).toBeNull();
  });

  it("gives a learning phase under way its own day while no challenge is ahead", () => {
    const current = phase(0, { endDate: "2026-11-20", state: "current" });
    const end = getPhaseEnd({ phase: current, plan: plan([current]) });
    expect(end).toStrictEqual({ estimate: false, isoDate: "2026-11-20", month: false });
  });

  it("says a far phase under way by its day, even while its challenge keeps it an estimate", () => {
    const checkpoint = { ...CHALLENGE, date: "2027-03-01" };
    const current = phase(0, { checkpoint, endDate: "2027-02-20", state: "current" });
    const end = getPhaseEnd({ phase: current, plan: plan([current]) });
    expect(end).toStrictEqual({ estimate: true, isoDate: "2027-03-01", month: false });
  });

  it("keeps a challenge on its phase's last day at that day", () => {
    const checkpoint = { ...CHALLENGE, date: "2026-11-20" };
    const current = phase(0, { checkpoint, endDate: "2026-11-20", state: "current" });
    const end = getPhaseEnd({ phase: current, plan: plan([current]) });
    expect(end).toMatchObject({ isoDate: "2026-11-20" });
  });

  it("estimates the end of a phase after the exam, like a learning phase", () => {
    const after = phase(1, { endDate: "2026-12-01", kind: "afterExam" });
    const end = getPhaseEnd({ phase: after, plan: plan([phase(0), after]) });
    expect(end).toStrictEqual({ estimate: true, isoDate: "2026-12-01", month: false });
  });

  it("ends the last phase before the exam with the plan, whatever comes after the exam", () => {
    const last = phase(0, { state: "current" });
    const afterExam = phase(1, { kind: "afterExam" });
    const shaped = plan([last, afterExam], { estimate: { endDate: "2026-12-12" } });
    const end = getPhaseEnd({ phase: last, plan: shaped });
    expect(end).toMatchObject({ isoDate: "2026-12-12" });
  });

  it("names a short plan's phase by its days", () => {
    const short = shortDays(1, 3);
    const current = phase(0, { endDate: "2026-11-17", short, state: "current" });
    const shaped = plan([current], { shortPlan: { days: 5, mockDate: null } });
    expect(getPhaseEnd({ phase: current, plan: shaped })).toStrictEqual({ short });
  });

  it("leaves a phase at its last lesson once its challenge is behind the learner", () => {
    const checkpoint = { ...CHALLENGE, state: "done" as const };
    const current = phase(0, { checkpoint, endDate: "2026-11-20", state: "current" });
    const end = getPhaseEnd({ phase: current, plan: plan([current]) });
    expect(end).toStrictEqual({ estimate: false, isoDate: "2026-11-20", month: false });
  });

  it("names a phase by its day when the plan isn't a short one", () => {
    const current = phase(0, { endDate: "2026-11-17", short: shortDays(1, 3), state: "current" });
    const end = getPhaseEnd({ phase: current, plan: plan([current]) });
    expect(end).toMatchObject({ isoDate: "2026-11-17" });
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

  it("is none for a plan with no date and no end yet", () => {
    expect(getRoadmapFinish({ goalKind: "learn", plan: plan([phase(0)]) })).toBeNull();
  });

  it("is none for an exam without a date", () => {
    const shaped = plan([phase(0)], { estimate: { endDate: "2026-12-12" } });
    expect(getRoadmapFinish({ goalKind: "exam", plan: shaped })).toBeNull();
  });
});

describe(getRoadmapPhases, () => {
  it("draws neither the phases after the exam nor those left out", () => {
    const drawn = getRoadmapPhases([
      phase(0, { state: "current" }),
      phase(1, { state: "leftOut" }),
      phase(2),
      phase(3, { kind: "afterExam" }),
    ]);

    expect(drawn.map((entry) => entry.index)).toStrictEqual([0, 2]);
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

  it("leaves any phase ending on the learner's today to Today, not only the current one", () => {
    const shaped = threePhases([TODAY, TODAY, "2026-12-01"]);
    expect(axis(shaped)).toStrictEqual([]);
  });

  it("dates only the phases the roadmap draws", () => {
    const shaped = plan([
      phase(0, { endDate: "2026-11-20", state: "current" }),
      phase(1, { endDate: "2026-11-25", state: "leftOut" }),
      phase(2, { endDate: "2026-12-01" }),
      phase(3, { endDate: "2026-12-10" }),
      phase(4, { endDate: "2027-01-10", kind: "afterExam" }),
    ]);

    expect(axis(shaped)).toStrictEqual([0, 2]);
  });

  it("dates a short plan's phases once each", () => {
    const shaped = plan(
      [
        phase(0, { endDate: "2026-11-16", short: shortDays(1, 2), state: "current" }),
        phase(1, { endDate: "2026-11-18", short: shortDays(3, 4) }),
        phase(2, { endDate: "2026-11-19", short: shortDays(5, 5) }),
      ],
      { shortPlan: { days: 5, mockDate: null } },
    );

    expect(axis(shaped)).toStrictEqual([0, 1]);
  });

  it("dates nothing on a one-phase plan, whose end is the goal's", () => {
    expect(axis(plan([phase(0, { endDate: "2026-12-01", state: "current" })]))).toStrictEqual([]);
  });

  it("dates nothing while no phase is under way", () => {
    const shaped = threePhases(["2026-11-20", "2026-12-01", "2026-12-10"], ["upcoming"]);
    expect(axis(shaped)).toStrictEqual([]);
  });
});

describe(getAxisFinish, () => {
  // The reviewer's plan: the last phase under way ends today, the goal's day.
  const endsToday = plan(
    [
      phase(0, { endDate: "2026-11-10", state: "done" }),
      phase(1, { endDate: TODAY, state: "current" }),
    ],
    { schedule: { targetDate: TODAY, targetDateEstimated: false, targetDateNamedMonth: false } },
  );

  it("leaves the goal's day to Today when it's the learner's today", () => {
    expect(getAxisFinish({ goalKind: "learn", plan: endsToday, today: TODAY })).toBeNull();
  });

  it("still names the goal's day and the phase's end everywhere else", () => {
    const finish = getRoadmapFinish({ goalKind: "learn", plan: endsToday });
    const end = getPhaseEnd({ phase: endsToday.phases[1] ?? phase(1), plan: endsToday });
    expect(finish).toStrictEqual({ estimate: false, isoDate: TODAY, month: false });
    expect(end).toStrictEqual({ estimate: false, isoDate: TODAY, month: false });
  });

  it("dates the goal's day when it's another day", () => {
    const later = getAxisFinish({ goalKind: "learn", plan: endsToday, today: "2026-11-14" });
    expect(later).toStrictEqual({ estimate: false, isoDate: TODAY, month: false });
  });

  it("dates the goal's day while no phase is under way, with no Today to say it", () => {
    const notStarted = plan([phase(0, { endDate: TODAY })], {
      schedule: { targetDate: TODAY, targetDateEstimated: false, targetDateNamedMonth: false },
    });

    expect(getAxisFinish({ goalKind: "learn", plan: notStarted, today: TODAY })).toMatchObject({
      isoDate: TODAY,
    });
  });
});
