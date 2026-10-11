import { describe, expect, it } from "vitest";
import { fromIsoDate } from "./plan-calendar";
import {
  countLessonChanges,
  getAddedSkillsStart,
  getFittedStandInLessons,
  getPlanEffect,
  getTopicChanges,
  needsApproval,
  startsBeforeBasics,
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
  // The stand-in is for the rest of a skill the plan has a lesson of: it counts the lessons still
  // missing, as the map sizes it.
  it("counts lessons added and removed, placeholders by their size, and the end date move", () => {
    const before = [
      item({ date: "2026-10-01", lessonId: "a", skillId: "fractions" }),
      item({ date: "2026-10-02", lessonId: "b" }),
    ];

    const after = [
      item({ date: "2026-10-01", lessonId: "a", skillId: "fractions" }),
      item({ date: "2026-10-05", skillId: "fractions" }),
    ];

    expect(getPlanEffect({ after, before, standInLessons })).toStrictEqual({
      endDateAfter: "2026-10-05",
      endDateBefore: "2026-10-02",
      lessonsAdded: 8,
      lessonsAddedEstimated: true,
      lessonsRemoved: 1,
    });
  });

  // A stand-in's lessons are the plan's estimate until the Library writes them: Pedro's card said
  // 8 lessons for a topic the Library wrote 5 for. Written lessons are no estimate (the test above
  // adds a stand-in, which is).
  it("says the lessons it adds are an estimate only when some aren't written yet", () => {
    const before = [item({ date: "2026-10-01", lessonId: "a" })];
    const written = [...before, item({ date: "2026-10-02", lessonId: "b" })];

    expect(getPlanEffect({ after: written, before, standInLessons })).not.toHaveProperty(
      "lessonsAddedEstimated",
    );
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

  it("counts a stand-in by its own part that fits, not its skill's: written lessons take the core first", () => {
    // 21 lessons, 4 written and 17 not: the plan covers the written ones and an eighth of the rest.
    const fitted = getFittedStandInLessons({
      skillMinutes: [
        { covered: 25, skillId: "media", standIn: { covered: 8, total: 64 }, total: 81 },
      ],
      standInLessons: new Map([["media", 17]]),
    });

    expect(fitted.get("media")).toBe(2);
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

/** A lesson item as the learner sees it in their plan. */
function seen({ lessonId, skillId }: { lessonId: string | null; skillId: string }) {
  return {
    chapterId: null,
    kind: "lesson" as const,
    lessonId,
    skillId,
    status: "todo" as const,
    titleSnapshot: lessonId ?? skillId,
  };
}

/** One lesson for a lesson; a stand-in plans 8. */
function countEight({ lessonId }: { lessonId: string | null }) {
  return lessonId ? 1 : 8;
}

describe(countLessonChanges, () => {
  // Maya's "Study everything" said it left out 1 lesson: a lesson two skills share was filed under
  // the other one by the new plan, and its first skill counted it as gone.
  it("counts a lesson the new plan files under another skill as the same lesson", () => {
    const before = [
      seen({ lessonId: "a", skillId: "notation" }),
      seen({ lessonId: "b", skillId: "notation" }),
    ];

    const after = [
      seen({ lessonId: "a", skillId: "comparing" }),
      seen({ lessonId: "b", skillId: "notation" }),
      seen({ lessonId: null, skillId: "waves" }),
    ];

    expect(
      countLessonChanges({ after, before, lessonsAfter: () => 1, lessonsBefore: () => 1 }),
    ).toStrictEqual({ lessonsAdded: 1, lessonsAddedEstimated: true, lessonsRemoved: 0 });
  });

  it("says the lessons a topic adds are an estimate while they aren't written", () => {
    const before = [seen({ lessonId: "a", skillId: "notation" })];

    const count = (after: ReturnType<typeof seen>[]) =>
      countLessonChanges({ after, before, lessonsAfter: countEight, lessonsBefore: countEight });

    expect(count([...before, seen({ lessonId: null, skillId: "dividends" })])).toStrictEqual({
      lessonsAdded: 8,
      lessonsAddedEstimated: true,
      lessonsRemoved: 0,
    });

    expect(count([...before, seen({ lessonId: "b", skillId: "dividends" })])).toStrictEqual({
      lessonsAdded: 1,
      lessonsRemoved: 0,
    });
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

  // Missed days left no time for a topic whose lessons weren't written yet: set aside, it's out of
  // the plan, and the change names it.
  it("reads a topic whose only item is set aside as left out", () => {
    const before = [
      item({ date: "2026-10-01", skillId: "cells" }),
      item({ date: "2026-10-02", skillId: "circuits" }),
    ];

    const after = [
      item({ date: "2026-10-01", skillId: "cells" }),
      { ...item({ date: "2026-10-02", skillId: "circuits" }), status: "skipped" as const },
    ];

    expect(getTopicChanges({ after, before, graph })).toStrictEqual({
      topicsAdded: [],
      topicsLeftOut: [{ area: "Natureza", topics: ["Eletricidade"] }],
    });
  });

  // A language plan's refresh at the learner's own pace left a situation out, and nothing said so.
  it("names the skills of a graph that maps no topics", () => {
    const untopiced: PlanGraph = {
      phases: [{ milestone: null, name: "Arriving" }],
      skills: graph.skills.map(({ topics: _topics, ...skill }) => ({ ...skill, area: null })),
    };

    const before = [
      item({ date: "2026-10-01", skillId: "cells" }),
      item({ date: "2026-10-02", skillId: "circuits" }),
    ];

    const after = [
      item({ date: "2026-10-01", skillId: "cells" }),
      item({ date: "2026-10-02", skillId: "heat" }),
    ];

    expect(getTopicChanges({ after, before, graph: untopiced })).toStrictEqual({
      topicsAdded: [{ area: "Arriving", topics: ["Heat"] }],
      topicsLeftOut: [{ area: "Arriving", topics: ["Circuits"] }],
    });
  });
});

describe("topics a change adds", () => {
  const project = new Set(["project"]);

  const basics = [
    { ...item({ date: "2026-10-09", lessonId: "safety", skillId: "safety" }) },
    { ...item({ date: "2026-10-10", lessonId: "tools", skillId: "tools" }) },
  ];

  const later = {
    ...item({ date: "2026-11-02", lessonId: "cabinet", skillId: "cabinet" }),
    phase: 1,
  };

  const added = item({ date: "2026-10-09", skillId: "project" });

  // A woodworking learner asked to start a nightstand of their own right away.
  it("says the topics asked for now start on their first day, before the basics", () => {
    const items = [added, ...basics, later];

    expect(getAddedSkillsStart({ items, skillIds: project })).toBe("2026-10-09");
    expect(startsBeforeBasics({ items, skillIds: project })).toBe(true);
  });

  it("never says before the basics for topics that come after some of them", () => {
    expect(
      startsBeforeBasics({
        items: [basics[0] ?? added, added, ...basics.slice(1)],
        skillIds: project,
      }),
    ).toBe(false);

    expect(startsBeforeBasics({ items: [added, later], skillIds: project })).toBe(false);
    expect(startsBeforeBasics({ items: [...basics, later], skillIds: project })).toBe(false);
  });
});
