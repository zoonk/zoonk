import { describe, expect, it } from "vitest";
import { fromIsoDate } from "./plan-calendar";
import { getPlanEffect, needsApproval } from "./plan-effect";

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
