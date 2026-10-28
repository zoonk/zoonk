import { describe, expect, it } from "vitest";
import { type TopicLevel } from "../../library/exams/topic-frequency";
import { withBaseChoices } from "./chosen-bases";
import { adviseOnBases, findPlanBases } from "./plan-bases";
import { fromIsoDate } from "./plan-calendar";
import { type PlanGraph, type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";

const AREA = "Ciências da Natureza";

function skill(skillId: string, topic: string, attrs: Partial<PlanGraphSkill> = {}) {
  return {
    area: AREA,
    lessons: 6,
    name: `Skill ${skillId}`,
    phase: 0,
    skillId,
    topics: [topic],
    weight: null,
    ...attrs,
  } satisfies PlanGraphSkill;
}

function lesson(lessonId: string, skillIds: string[], minutes = 4): PlannerLesson {
  return { chapterId: "chapter", lessonId, minutes, skillIds, title: `Lesson ${lessonId}` };
}

function level(topic: string, value: TopicLevel["level"]): TopicLevel {
  return { level: value, subject: AREA, topic };
}

const GRAPH: PlanGraph = {
  phases: [{ milestone: null, name: "Fundamentos" }],
  skills: [
    skill("cells", "Células"),
    skill("living", "Seres vivos", { lessons: 9 }),
    skill("ecology", "Ecologia"),
    skill("water", "Água"),
  ],
};

const LEVELS = [
  level("Células", "high"),
  level("Seres vivos", "low"),
  level("Ecologia", "high"),
  level("Água", "low"),
];

const PREREQUISITES = new Map([
  ["living", ["cells"]],
  ["ecology", ["living"]],
]);

const LESSONS = [
  lesson("living-1", ["living"], 5),
  lesson("living-2", ["living"]),
  lesson("living-3", ["living"]),
  lesson("ecology-1", ["ecology"]),
];

function doneLesson(lessonId: string) {
  return {
    chapterId: "chapter",
    completedAt: null,
    kind: "lesson" as const,
    lessonId,
    skillId: "living",
    status: "done" as const,
  };
}

function findBases(attrs: Partial<Parameters<typeof findPlanBases>[0]> = {}) {
  return findPlanBases({
    graph: GRAPH,
    items: [],
    lessons: LESSONS,
    paceFactor: 1,
    prerequisites: PREREQUISITES,
    settings: parsePlanSettings({}),
    topicLevels: LEVELS,
    ...attrs,
  });
}

describe(findPlanBases, () => {
  it("lists the skills a more asked topic builds on, with what each way of studying them takes", () => {
    expect(findBases()).toStrictEqual([
      {
        area: AREA,
        choices: ["deep", "essential", "quick", "skip"],
        known: false,
        minutes: { deep: 37, essential: 13, quick: 4 },
        name: "Skill living",
        neededFor: ["Ecologia"],
        skillId: "living",
        studied: false,
      },
    ]);
  });

  it("opens a base whose core the learner studied to deep study only", () => {
    const items = ["living-1", "living-2", "living-3"].map((lessonId) => doneLesson(lessonId));

    expect(findBases({ items })).toMatchObject([
      { choices: ["deep"], skillId: "living", studied: true },
    ]);
  });

  it("has no bases for a goal that neither weighs its topics nor has outcome skills", () => {
    expect(findBases({ topicLevels: [] })).toStrictEqual([]);
  });

  it("offers a skill beyond the notice that a topic builds on, whether or not the topics are rated", () => {
    const beyond = skill("formats", "", { topics: [] });
    const graph = { ...GRAPH, skills: [beyond, ...GRAPH.skills] };
    const prerequisites = new Map([...PREREQUISITES, ["water", ["formats"]]]);

    for (const topicLevels of [LEVELS, []]) {
      const bases = findBases({ graph, prerequisites, topicLevels });
      const formats = bases.find((base) => base.skillId === "formats");

      expect(formats?.neededFor).toStrictEqual(["Água"]);
    }
  });

  describe("a goal with outcome skills (a career change)", () => {
    const career: PlanGraph = {
      phases: [{ milestone: null, name: "UX" }],
      skills: [
        skill("statistics", "", { area: "Métricas", topics: [] }),
        skill("research", "", { area: "Pesquisa", topics: [] }),
        skill("wireframes", "", { area: "Prototipação", topics: [] }),
        skill("portfolio", "", { area: "Portfólio", outcome: true, topics: [] }),
        skill("metrics", "", { area: "Métricas", topics: [] }),
        skill("product", "", { area: "Portfólio", outcome: true, topics: [] }),
      ],
    };

    const bands = new Map([
      ["statistics", "overview"],
      ["research", "beginner"],
      ["wireframes", "beginner"],
      ["portfolio", "beginner"],
      ["metrics", "intermediate"],
      ["product", "intermediate"],
    ] as const);

    function careerBases(attrs: Partial<Parameters<typeof findPlanBases>[0]> = {}) {
      return findBases({
        bands,
        graph: career,
        lessons: [],
        prerequisites: new Map([
          ["wireframes", ["research"]],
          ["portfolio", ["wireframes"]],
          ["metrics", ["statistics"]],
          ["product", ["portfolio", "metrics"]],
        ]),
        topicLevels: [],
        ...attrs,
      }).map((base) => [base.skillId, base.neededFor]);
    }

    it("keeps the course its path: only a foundation from an easier band than the work built on it is a base", () => {
      expect(careerBases()).toStrictEqual([["statistics", ["Skill product"]]]);
    });

    it("adds the skills below the level the learner said they have: what they may already know", () => {
      expect(careerBases({ levelFloor: "intermediate" })).toStrictEqual([
        ["statistics", ["Skill product"]],
        ["research", ["Skill portfolio", "Skill product"]],
        ["wireframes", ["Skill portfolio", "Skill product"]],
      ]);
    });

    it("has none whose band it doesn't know", () => {
      expect(careerBases({ bands: new Map() })).toStrictEqual([]);
    });
  });

  it("marks a base placement found the learner knows, with nothing to choose", () => {
    const bases = findBases({
      items: [
        {
          chapterId: null,
          completedAt: null,
          kind: "lesson",
          lessonId: null,
          skillId: "living",
          status: "testedOut",
        },
      ],
    });

    expect(bases.map((base) => [base.skillId, base.known])).toStrictEqual([["living", true]]);
  });

  it("stops at a topic the learner knows: what it builds on isn't needed for it", () => {
    const bases = findBases({
      items: [
        {
          chapterId: null,
          completedAt: null,
          kind: "lesson",
          lessonId: null,
          skillId: "ecology",
          status: "testedOut",
        },
      ],
    });

    expect(bases).toStrictEqual([]);
  });

  it("leaves out a base whose lessons the learner finished", () => {
    const graph = {
      ...GRAPH,
      skills: GRAPH.skills.map((entry) =>
        entry.skillId === "living" ? { ...entry, lessons: 3 } : entry,
      ),
    };

    const bases = findBases({
      graph,
      items: ["living-1", "living-2", "living-3"].map((lessonId) => doneLesson(lessonId)),
    });

    expect(bases).toStrictEqual([]);
  });

  it("keeps a base whose core the learner finished while it has lessons past it", () => {
    const bases = findBases({
      items: ["living-1", "living-2", "living-3"].map((lessonId) => doneLesson(lessonId)),
    });

    expect(bases.map((base) => base.skillId)).toStrictEqual(["living"]);
  });
});

function applyBaseChoices({
  choices,
  items = [],
  ...input
}: Omit<Parameters<typeof withBaseChoices>[0]["input"], "items"> & {
  choices: Parameters<typeof withBaseChoices>[0]["choices"];
  items?: Parameters<typeof withBaseChoices>[0]["input"]["items"];
}) {
  return withBaseChoices({ choices, input: { ...input, items } });
}

function livingLessons(chosen: ReturnType<typeof applyBaseChoices>) {
  return {
    graph: chosen.graph.skills.find((entry) => entry.skillId === "living")?.lessons,
    lessons: chosen.lessons
      .filter((entry) => entry.skillIds.includes("living"))
      .map((entry) => entry.lessonId),
  };
}

describe(withBaseChoices, () => {
  const bases = findBases();

  it("keeps a base's core, the first third of its lessons, unless the learner chose otherwise", () => {
    const chosen = applyBaseChoices({ bases, choices: [], graph: GRAPH, lessons: LESSONS });

    expect(livingLessons(chosen)).toStrictEqual({
      graph: 3,
      lessons: ["living-1", "living-2", "living-3"],
    });
  });

  it("keeps the rest of the chapter the learner is in the middle of with a base's core", () => {
    const lessons = [
      ...["living-1", "living-2", "living-3", "living-4"].map((lessonId) =>
        lesson(lessonId, ["living"]),
      ),
      { ...lesson("living-5", ["living"]), chapterId: "later" },
      ...LESSONS.filter((entry) => !entry.skillIds.includes("living")),
    ];

    const items = ["living-1", "living-2", "living-4"].map((lessonId, index) => ({
      ...doneLesson(lessonId),
      completedAt: index === 0 ? new Date("2026-10-12T10:00:00Z") : null,
      scheduledFor: null,
      status: index === 0 ? ("done" as const) : ("todo" as const),
    }));

    const chosen = applyBaseChoices({ bases, choices: [], graph: GRAPH, items, lessons });

    expect(livingLessons(chosen)).toStrictEqual({
      graph: 4,
      lessons: ["living-1", "living-2", "living-3", "living-4"],
    });
  });

  it("keeps every lesson of a base studied in depth", () => {
    const chosen = applyBaseChoices({
      bases,
      choices: [{ choice: "deep", skillId: "living" }],
      graph: GRAPH,
      lessons: LESSONS,
    });

    expect(livingLessons(chosen)).toStrictEqual({
      graph: 9,
      lessons: ["living-1", "living-2", "living-3"],
    });
  });

  it("plans a base's quick lesson in place of its lessons, a stand-in of one while it isn't written", () => {
    const choices = [{ choice: "quick" as const, skillId: "living" }];
    const quick = lesson("living-quick", ["living"]);

    const chosen = applyBaseChoices({
      bases,
      choices,
      graph: GRAPH,
      lessons: LESSONS,
      quickLessons: new Map([["living", quick]]),
    });

    expect(livingLessons(chosen)).toStrictEqual({ graph: 1, lessons: ["living-quick"] });

    expect(
      livingLessons(applyBaseChoices({ bases, choices, graph: GRAPH, lessons: LESSONS })),
    ).toStrictEqual({ graph: 1, lessons: [] });
  });

  it("takes a skipped base out of the plan", () => {
    const chosen = applyBaseChoices({
      bases,
      choices: [{ choice: "skip", skillId: "living" }],
      graph: GRAPH,
      lessons: LESSONS,
    });

    expect(chosen.graph.skills.map((entry) => entry.skillId)).toStrictEqual([
      "cells",
      "ecology",
      "water",
    ]);

    expect(chosen.lessons.some((entry) => entry.skillIds.includes("living"))).toBe(false);
  });

  it("ignores a choice for a skill that is no longer a base", () => {
    const chosen = applyBaseChoices({
      bases,
      choices: [{ choice: "skip", skillId: "water" }],
      graph: GRAPH,
      lessons: LESSONS,
    });

    expect(chosen).toStrictEqual(
      applyBaseChoices({ bases, choices: [], graph: GRAPH, lessons: LESSONS }),
    );
  });

  it("changes nothing for a goal without bases", () => {
    const chosen = applyBaseChoices({ bases: [], choices: [], graph: GRAPH, lessons: LESSONS });

    expect(chosen.graph).toBe(GRAPH);
  });
});

describe(adviseOnBases, () => {
  const today = fromIsoDate("2026-10-09");
  const bases = findBases();

  it("recommends a quick lesson for each when the exam is close and the time doesn't cover everything", () => {
    expect(
      adviseOnBases({ bases, fits: () => false, targetDate: fromIsoDate("2026-10-29"), today }),
    ).toMatchObject({ daysLeft: 20, recommended: "quick" });
  });

  it("recommends their core far from the exam when the time doesn't cover everything", () => {
    expect(
      adviseOnBases({ bases, fits: () => false, targetDate: fromIsoDate("2027-03-01"), today }),
    ).toMatchObject({ recommended: "essential" });
  });

  it("recommends them in depth when the time covers everything, close to the date or without one", () => {
    expect(
      adviseOnBases({ bases, fits: () => true, targetDate: fromIsoDate("2026-10-29"), today }),
    ).toMatchObject({ recommended: "deep" });

    expect(adviseOnBases({ bases, fits: () => true, targetDate: null, today })).toMatchObject({
      daysLeft: null,
      recommended: "deep",
    });
  });
});
