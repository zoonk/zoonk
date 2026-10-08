import { describe, expect, it } from "vitest";
import { fromIsoDate } from "./plan-calendar";
import {
  getFittedStandInLessons,
  getPlanEffect,
  getTopicChanges,
  needsApproval,
} from "./plan-effect";
import { type PlanGraph } from "./plan-state";

/** Fractions has a stand-in of 8 lessons the Library hasn't outlined yet. */
const standInLessons = new Map([["fractions", 8]]);

function item(attrs: { date: string; lessonId?: string; skillId?: string }) {
  return {
    chapterId: null,
    id: null,
    kind: "lesson" as const,
    lessonId: attrs.lessonId ?? null,
    phase: 0,
    scheduledFor: fromIsoDate(attrs.date),
    skillId: attrs.skillId ?? null,
    status: "todo" as const,
  };
}

describe(getPlanEffect, () => {
  it("counts lessons added and removed, placeholders by their size, and the end date move", () => {
    const before = [
      item({ date: "2026-10-01", lessonId: "a" }),
      item({ date: "2026-10-02", lessonId: "b" }),
    ];

    const after = [
      item({ date: "2026-10-01", lessonId: "a" }),
      item({ date: "2026-10-05", skillId: "fractions" }),
    ];

    expect(getPlanEffect({ after, before, standInLessons })).toStrictEqual({
      endDateAfter: "2026-10-05",
      endDateBefore: "2026-10-02",
      lessonsAdded: 8,
      lessonsRemoved: 1,
    });
  });

  it("counts a stand-in for the rest of a skill as the lessons still missing", () => {
    const before = [item({ date: "2026-10-01", lessonId: "a", skillId: "fractions" })];

    const after = [
      item({ date: "2026-10-01", lessonId: "a", skillId: "fractions" }),
      item({ date: "2026-10-03", skillId: "fractions" }),
    ];

    expect(
      getPlanEffect({ after, before, standInLessons: new Map([["fractions", 5]]) }).lessonsAdded,
    ).toBe(5);
  });
});

describe(getFittedStandInLessons, () => {
  it("counts a stand-in by the part of it that fits, so a change never claims a whole skill", () => {
    // 32 lessons not outlined yet, of which an eighth fits before the deadline after the change.
    const fitted = getFittedStandInLessons({
      skillMinutes: [{ covered: 12, skillId: "fractions", total: 96 }],
      standInLessons: new Map([["fractions", 32]]),
    });

    const after = [item({ date: "2026-10-05", skillId: "fractions" })];

    expect(getPlanEffect({ after, before: [], standInLessons: fitted }).lessonsAdded).toBe(4);
  });

  it("counts the lessons a stand-in in both plans gains or loses", () => {
    const stays = [item({ date: "2026-10-05", skillId: "fractions" })];

    expect(
      getPlanEffect({
        after: stays,
        before: stays,
        standInLessons: new Map([["fractions", 6]]),
        standInLessonsBefore: new Map([["fractions", 2]]),
      }),
    ).toMatchObject({ lessonsAdded: 4, lessonsRemoved: 0 });
  });
});

describe(needsApproval, () => {
  it("lets a one-lesson change through and holds anything bigger", () => {
    const small = {
      endDateAfter: "2026-10-03",
      endDateBefore: "2026-10-02",
      lessonsAdded: 1,
      lessonsRemoved: 0,
    };

    expect(needsApproval(small)).toBe(false);
    expect(needsApproval({ ...small, lessonsAdded: 2 })).toBe(true);
    expect(needsApproval({ ...small, endDateAfter: "2026-10-09" })).toBe(true);
  });
});

describe(getTopicChanges, () => {
  const graph: PlanGraph = {
    phases: [],
    skills: [
      {
        area: "Natureza",
        lessons: 4,
        name: "Cells",
        phase: 0,
        skillId: "cells",
        topics: ["Células"],
        weight: 3,
      },
      {
        area: "Natureza",
        lessons: 4,
        name: "Circuits",
        phase: 0,
        skillId: "circuits",
        topics: ["Eletricidade"],
        weight: 3,
      },
      {
        area: "Natureza",
        lessons: 4,
        name: "Heat",
        phase: 0,
        skillId: "heat",
        topics: ["Calor"],
        weight: 3,
      },
      {
        area: "Natureza",
        lessons: 4,
        name: "Genetics",
        phase: 0,
        skillId: "genetics",
        topics: ["Genética", "Células"],
        weight: 3,
      },
    ],
  };

  it("names the topics a change brings into the plan and the ones it leaves out, by subject", () => {
    const before = [
      item({ date: "2026-10-01", skillId: "cells" }),
      item({ date: "2026-10-02", skillId: "circuits" }),
      item({ date: "2026-10-03", skillId: "heat" }),
    ];

    const after = [
      item({ date: "2026-10-01", skillId: "cells" }),
      item({ date: "2026-10-02", skillId: "genetics" }),
    ];

    expect(getTopicChanges({ after, before, graph })).toStrictEqual({
      topicsAdded: [{ area: "Natureza", topics: ["Genética"] }],
      topicsLeftOut: [{ area: "Natureza", topics: ["Eletricidade", "Calor"] }],
    });
  });
});
