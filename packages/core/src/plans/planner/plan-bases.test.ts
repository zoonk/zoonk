import { describe, expect, it } from "vitest";
import { type TopicLevel } from "../../library/exams/topic-frequency";
import { applyBaseChoices } from "./chosen-bases";
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

/**
 * ENEM's ecology builds on how living things work, which builds on cells; a separate topic on
 * water builds on nothing. Ecology and cells come up a lot, living things and water less.
 */
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
  // Never cells, which the exam asks most, nor water, which nothing builds on.
  it("lists the skills a more asked topic builds on, with what each way of studying them takes", () => {
    expect(findBases()).toStrictEqual([
      {
        area: AREA,
        known: false,
        // Three lessons outlined and six still to write: its core is the first three, and a quick
        // lesson takes one lesson's time.
        minutes: { deep: 37, essential: 13, quick: 4 },
        name: "Skill living",
        neededFor: ["Ecologia"],
        skillId: "living",
      },
    ]);
  });

  it("has no bases for a goal that neither weighs its topics nor has outcome skills", () => {
    expect(findBases({ topicLevels: [] })).toStrictEqual([]);
  });

  // Rafaela's IT topic on data concepts was planned after all 26 lessons of digital-records formats,
  // a skill her notice doesn't name: the learner chooses how to study one, like any base.
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
    /**
     * A UX career: research and wireframes build up to the first portfolio project, all at the
     * beginner band, the way a career graph makes its course the path; basic statistics, from an
     * easier band, is what the metrics a later project needs build on.
     */
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
      // Research and wireframes are the first project's own band: they're the course, not bases.
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

  // A base studied for its core has nothing left in the plan once the core is done. Read as
  // finished, the next run planned it whole and the one after for its core again, so every open
  // of Today moved its last lessons in and out of a career plan.
  it("keeps a base whose core the learner finished while it has lessons past it", () => {
    const bases = findBases({
      items: ["living-1", "living-2", "living-3"].map((lessonId) => doneLesson(lessonId)),
    });

    expect(bases.map((base) => base.skillId)).toStrictEqual(["living"]);
  });
});

/** What the planner gets of the base: its graph size and the lessons planned under it. */
function livingLessons(chosen: ReturnType<typeof applyBaseChoices>) {
  return {
    graph: chosen.graph.skills.find((entry) => entry.skillId === "living")?.lessons,
    lessons: chosen.lessons
      .filter((entry) => entry.skillIds.includes("living"))
      .map((entry) => entry.lessonId),
  };
}

describe(applyBaseChoices, () => {
  const bases = findBases();

  it("keeps a base's core, the first third of its lessons, unless the learner chose otherwise", () => {
    const chosen = applyBaseChoices({ bases, choices: [], graph: GRAPH, lessons: LESSONS });

    expect(livingLessons(chosen)).toStrictEqual({
      graph: 3,
      lessons: ["living-1", "living-2", "living-3"],
    });
  });

  // Skipping a career's portfolio made the problem-definition skill the learner was in the middle
  // of a base, and its core cut the rest of that chapter and its challenge (career 1254).
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

describe(parsePlanSettings, () => {
  it("reads base choices saved before there were four: a first lesson only is a quick lesson now", () => {
    expect(
      parsePlanSettings({
        baseChoices: [
          { choice: "essentials", skillId: "living" },
          { choice: "learn", skillId: "water" },
          { choice: "skip", skillId: "cells" },
        ],
        focusAreas: ["Biologia"],
      }),
    ).toMatchObject({
      baseChoices: [
        { choice: "quick", skillId: "living" },
        { choice: "skip", skillId: "cells" },
      ],
      focusAreas: ["Biologia"],
    });
  });
});
