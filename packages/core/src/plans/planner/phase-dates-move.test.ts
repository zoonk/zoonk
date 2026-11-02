import { describe, expect, it } from "vitest";
import {
  getPhaseDatesEffect,
  isKeptOver,
  isPhaseDatesMoveWorth,
  mayCostToKeepPhaseDates,
  moveStrainedEnds,
  showsPhaseDatesMove,
} from "./phase-dates-move";
import { type PlanPhase } from "./plan-state";

function phase(name: string, endDate: string): PlanPhase {
  return { endDate, kind: "learn", milestone: null, minutes: 0, name, startDate: null };
}

const graph = {
  skills: [
    { area: "UX", lessons: 4, name: "User research", phase: 0, skillId: "research", weight: 1 },
    {
      area: "Career",
      lessons: 4,
      name: "Interviews",
      outcome: true,
      phase: 1,
      skillId: "interviews",
      weight: 1,
    },
    {
      area: "Career",
      lessons: 4,
      name: "Networking",
      outcome: true,
      phase: 1,
      skillId: "networking",
      weight: 1,
    },
  ],
};

const shown = [phase("Research", "2026-10-17"), phase("Job search", "2026-11-30")];

describe(getPhaseDatesEffect, () => {
  it("names the job search lessons keeping the dates leaves out and moving them fits in", () => {
    const effect = getPhaseDatesEffect({
      graph,
      kept: {
        droppedSkillIds: ["interviews", "research"],
        endsBeforeLessons: [],
        strainedEnds: [],
      },
      moved: {
        droppedSkillIds: ["research"],
        phases: [phase("Research", "2026-10-19"), phase("Job search", "2026-11-30")],
      },
      shown,
    });

    expect(effect).toStrictEqual({
      outcomesAdded: ["Interviews"],
      phaseEnds: [{ after: "2026-10-19", before: "2026-10-17", name: "Research" }],
    });
  });

  it("says a phase's end falls on a day the learner rests", () => {
    const effect = getPhaseDatesEffect({
      graph,
      kept: {
        droppedSkillIds: [],
        endsBeforeLessons: [],
        strainedEnds: [{ phase: 0, resting: true, room: "2026-10-18" }],
      },
      moved: {
        droppedSkillIds: [],
        phases: [phase("Research", "2026-10-16"), phase("Job search", "2026-11-30")],
      },
      shown,
    });

    expect(effect).toStrictEqual({
      phaseEnds: [{ after: "2026-10-16", before: "2026-10-17", name: "Research", restDay: true }],
    });
  });
});

describe(moveStrainedEnds, () => {
  const ends = new Map([
    [0, "2026-10-17"],
    [1, "2026-10-18"],
    [2, "2026-11-30"],
  ]);

  it("moves an end the learner rests on to the next day with room, and a later end it would pass", () => {
    expect(
      moveStrainedEnds({ ends, strained: [{ phase: 0, resting: true, room: "2026-10-19" }] }),
    ).toStrictEqual(
      new Map([
        [0, "2026-10-19"],
        [1, "2026-10-19"],
        [2, "2026-11-30"],
      ]),
    );
  });

  it("moves an end to the next day with room and leaves an end a month later where it was", () => {
    const far = new Map([
      [0, "2026-11-09"],
      [1, "2026-12-14"],
      [2, "2027-02-13"],
    ]);

    expect(
      moveStrainedEnds({ ends: far, strained: [{ phase: 0, resting: true, room: "2026-11-10" }] }),
    ).toStrictEqual(
      new Map([
        [0, "2026-11-10"],
        [1, "2026-12-14"],
        [2, "2027-02-13"],
      ]),
    );
  });

  it("moves the later of two challenges a day can't hold together, and nothing else", () => {
    const shared = new Map([
      [0, "2026-10-27"],
      [1, "2026-10-27"],
      [2, "2026-11-30"],
    ]);

    expect(
      moveStrainedEnds({
        ends: shared,
        strained: [
          { phase: 0, resting: false, room: "2026-10-28" },
          { phase: 1, resting: false, room: "2026-10-28" },
        ],
      }),
    ).toStrictEqual(
      new Map([
        [0, "2026-10-27"],
        [1, "2026-10-28"],
        [2, "2026-11-30"],
      ]),
    );
  });

  it("keeps an end that has no later day with room", () => {
    expect(
      moveStrainedEnds({ ends, strained: [{ phase: 1, resting: true, room: null }] }),
    ).toStrictEqual(ends);
  });
});

describe(isKeptOver, () => {
  const move = { after: "2026-10-19", before: "2026-10-17", name: "Research" };

  it("counts a decline over what the card named", () => {
    const declined = {
      outcomesAdded: ["Interviews"],
      phaseEnds: [{ ...move, restDay: true as const }],
    };

    expect(
      isKeptOver({ declined, effect: { outcomesAdded: ["Interviews"], phaseEnds: [move] } }),
    ).toBe(true);
  });

  it("asks again when keeping the dates now leaves out a job search skill the card didn't name", () => {
    const declined = { phaseEnds: [{ ...move, restDay: true as const }] };

    expect(
      isKeptOver({ declined, effect: { outcomesAdded: ["Networking"], phaseEnds: [move] } }),
    ).toBe(false);
  });

  it("asks again when a challenge now falls on a rest day the card didn't name", () => {
    expect(
      isKeptOver({
        declined: { phaseEnds: [move] },
        effect: { phaseEnds: [{ ...move, restDay: true as const }] },
      }),
    ).toBe(false);
  });
});

function movePlan({ covered, dropped }: { covered: number; dropped: string[] }) {
  return {
    droppedSkillIds: dropped,
    endsBeforeLessons: [],
    phases: shown,
    skillMinutes: [{ covered, skillId: "research", total: 60 }],
    strainedEnds: [],
  };
}

describe(isPhaseDatesMoveWorth, () => {
  it("moves the dates when that fits job search work keeping them leaves out", () => {
    expect(
      isPhaseDatesMoveWorth({
        graph,
        kept: movePlan({ covered: 30, dropped: ["interviews", "research"] }),
        moved: movePlan({ covered: 25, dropped: ["research"] }),
      }),
    ).toBe(true);
  });

  it("keeps the dates when moving them fits nothing more", () => {
    expect(
      isPhaseDatesMoveWorth({
        graph,
        kept: movePlan({ covered: 30, dropped: ["research"] }),
        moved: movePlan({ covered: 30, dropped: ["research"] }),
      }),
    ).toBe(false);
  });
});

describe("a kept end whose challenge would come before its lessons", () => {
  it("costs something to keep, and the move says why", () => {
    const kept = { droppedSkillIds: [], endsBeforeLessons: [0], strainedEnds: [] };

    expect(mayCostToKeepPhaseDates(kept)).toBe(true);

    expect(
      getPhaseDatesEffect({
        graph,
        kept,
        moved: {
          droppedSkillIds: [],
          phases: [phase("Research", "2026-10-19"), phase("Job search", "2026-11-30")],
        },
        shown,
      }),
    ).toStrictEqual({
      phaseEnds: [
        { after: "2026-10-19", before: "2026-10-17", lessonsFirst: true, name: "Research" },
      ],
    });
  });

  it("asks again when a challenge now comes before lessons the declined card didn't name", () => {
    const move = { after: "2026-10-19", before: "2026-10-17", name: "Research" };

    expect(
      isKeptOver({
        declined: { phaseEnds: [move] },
        effect: { phaseEnds: [{ ...move, lessonsFirst: true as const }] },
      }),
    ).toBe(false);
  });
});

describe(showsPhaseDatesMove, () => {
  const effect = { endDateAfter: null, endDateBefore: null, lessonsAdded: 0, lessonsRemoved: 0 };

  it("proposes nothing a card couldn't name", () => {
    expect(showsPhaseDatesMove({ ...effect, phaseEnds: [] })).toBe(false);
  });

  it("proposes an end that moves, job search work, or lessons it fits in", () => {
    const move = { after: "2026-10-19", before: "2026-10-17", name: "Research" };

    expect(showsPhaseDatesMove({ ...effect, phaseEnds: [move] })).toBe(true);
    expect(showsPhaseDatesMove({ ...effect, outcomesAdded: ["Interviews"] })).toBe(true);
    expect(showsPhaseDatesMove({ ...effect, lessonsAdded: 2 })).toBe(true);
  });
});
