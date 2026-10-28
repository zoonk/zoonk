import { describe, expect, it } from "vitest";
import { fromIsoDate } from "./plan-calendar";
import {
  type PlanEffect,
  getAddedSkillsStart,
  getFittedStandInLessons,
  getSeenChange,
  needsApproval,
  startsBeforeBasics,
} from "./plan-effect";
import { type PlanGraph } from "./plan-state";
import { getTopicChanges } from "./topic-changes";

const noTopics: PlanGraph = { skills: [] } as unknown as PlanGraph;

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
    titleSnapshot: attrs.lessonId ?? attrs.skillId ?? "",
  };
}

function sizedBy(sizes: Record<string, number>) {
  return ({ lessonId, skillId }: { lessonId: string | null; skillId: string | null }) =>
    lessonId ? 1 : (sizes[skillId ?? ""] ?? 1);
}

describe(getSeenChange, () => {
  it("counts lessons added and removed skill by skill, stand-ins by their size, and the end date move", () => {
    const before = [
      item({ date: "2026-10-01", lessonId: "a", skillId: "fractions" }),
      item({ date: "2026-10-02", lessonId: "b" }),
    ];

    const after = [
      item({ date: "2026-10-01", lessonId: "a", skillId: "fractions" }),
      item({ date: "2026-10-05", skillId: "fractions" }),
    ];

    const sizes = sizedBy({ fractions: 8 });

    expect(
      getSeenChange({ after, before, graph: noTopics, lessonsAfter: sizes, lessonsBefore: sizes }),
    ).toStrictEqual({
      endDateAfter: "2026-10-05",
      endDateBefore: "2026-10-02",
      lessonsAdded: 8,
      lessonsAddedEstimated: true,
      lessonsLeftOut: ["b"],
      lessonsRemoved: 1,
    });
  });

  it("says the lessons it adds are an estimate only when some aren't written yet", () => {
    const before = [item({ date: "2026-10-01", lessonId: "a" })];
    const written = [...before, item({ date: "2026-10-02", lessonId: "b" })];
    const sizes = sizedBy({});

    expect(
      getSeenChange({
        after: written,
        before,
        graph: noTopics,
        lessonsAfter: sizes,
        lessonsBefore: sizes,
      }),
    ).not.toHaveProperty("lessonsAddedEstimated");
  });

  it("counts a stand-in that shrinks as the lessons it leaves out, by its skill", () => {
    const stays = [item({ date: "2026-10-05", skillId: "fractions" })];

    const graph = {
      phases: [{ milestone: null, name: "Only" }],
      skills: [{ area: "Math", name: "Fractions", phase: 0, skillId: "fractions" }],
    } as unknown as PlanGraph;

    expect(
      getSeenChange({
        after: stays,
        before: stays,
        graph,
        lessonsAfter: sizedBy({ fractions: 2 }),
        lessonsBefore: sizedBy({ fractions: 8 }),
      }),
    ).toMatchObject({
      lessonsAdded: 0,
      lessonsRemoved: 6,
      unwrittenLeftOut: [{ lessons: 6, skill: "Fractions" }],
    });
  });

  it("counts lessons written since the save as the stand-in's own", () => {
    const before = [item({ date: "2026-10-05", skillId: "x" })];

    const after = [
      ...["a", "b", "c"].map((lessonId) => item({ date: "2026-10-05", lessonId, skillId: "x" })),
      item({ date: "2026-10-06", skillId: "x" }),
    ];

    expect(
      getSeenChange({
        after,
        before,
        graph: noTopics,
        lessonsAfter: sizedBy({ x: 5 }),
        lessonsBefore: sizedBy({ x: 8 }),
      }),
    ).toMatchObject({ lessonsAdded: 0, lessonsRemoved: 0 });
  });
});

describe(getFittedStandInLessons, () => {
  it("counts a stand-in by the part of it that fits, so a change never claims a whole skill", () => {
    const fitted = getFittedStandInLessons({
      skillMinutes: [{ covered: 12, skillId: "fractions", total: 96 }],
      standInLessons: new Map([["fractions", 32]]),
    });

    expect(fitted.get("fractions")).toBe(4);
  });

  it("counts a stand-in by its own part that fits, not its skill's: written lessons take the core first", () => {
    const fitted = getFittedStandInLessons({
      skillMinutes: [
        { covered: 25, skillId: "media", standIn: { covered: 8, total: 64 }, total: 81 },
      ],
      standInLessons: new Map([["media", 17]]),
    });

    expect(fitted.get("media")).toBe(2);
  });
});

function seen({ lessonId, skillId }: { lessonId: string | null; skillId: string }) {
  return {
    chapterId: null,
    kind: "lesson" as const,
    lessonId,
    scheduledFor: null,
    skillId,
    status: "todo" as const,
    titleSnapshot: lessonId ?? skillId,
  };
}

function countLessons(
  input: Omit<Parameters<typeof getSeenChange>[0], "graph">,
): Pick<PlanEffect, "lessonsAdded" | "lessonsAddedEstimated" | "lessonsRemoved"> {
  const { lessonsAdded, lessonsAddedEstimated, lessonsRemoved } = getSeenChange({
    ...input,
    graph: noTopics,
  });

  return { lessonsAdded, ...(lessonsAddedEstimated && { lessonsAddedEstimated }), lessonsRemoved };
}

function countEight({ lessonId }: { lessonId: string | null }) {
  return lessonId ? 1 : 8;
}

describe("lessons counted skill by skill", () => {
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
      countLessons({ after, before, lessonsAfter: () => 1, lessonsBefore: () => 1 }),
    ).toStrictEqual({ lessonsAdded: 1, lessonsAddedEstimated: true, lessonsRemoved: 0 });
  });

  it("says the lessons a topic adds are an estimate while they aren't written", () => {
    const before = [seen({ lessonId: "a", skillId: "notation" })];

    const count = (after: ReturnType<typeof seen>[]) =>
      countLessons({ after, before, lessonsAfter: countEight, lessonsBefore: countEight });

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
