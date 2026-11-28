import { type ExamOutline } from "@zoonk/ai/tasks/curriculum/exam-outline";
import { describe, expect, it } from "vitest";
import { applyGraphCoverage, needsCoverageCheck } from "./add-coverage-skills";
import { type GoalSkillGraph } from "./save-goal-skills";
import { toTopicSkillName } from "./uncovered-topic-skill";

function skill(overrides: Partial<GoalSkillGraph["skills"][number]> & { key: string }) {
  return {
    area: "Biology",
    course: "bio",
    description: `Idea ${overrides.key}`,
    estimatedLessons: 3,
    examWeight: null,
    level: "beginner" as const,
    name: `Skill ${overrides.key}`,
    phase: 1,
    prerequisites: [],
    topics: [],
    ...overrides,
  };
}

const graph: GoalSkillGraph = {
  courses: [
    { countrySpecific: false, key: "bio", levels: ["beginner", "intermediate"], title: "Biology" },
  ],
  estimatedHours: 3,
  phases: [
    { estimatedHours: 1, milestone: "Cells", title: "Cells" },
    { estimatedHours: 2, milestone: "Genes", title: "Genes" },
  ],
  skills: [
    skill({ key: "cell" }),
    skill({ key: "dna", level: "intermediate", phase: 2, prerequisites: ["cell"] }),
    skill({ key: "rna", phase: 2 }),
  ],
};

function missing(overrides: {
  area?: string;
  examWeight?: number;
  name: string;
  prerequisites: string[];
  topics?: string[];
}) {
  return {
    area: null,
    description: `Idea of ${overrides.name}`,
    estimatedLessons: 7,
    examWeight: null,
    reference: "Syllabus",
    syllabusLine: `Line about ${overrides.name}`,
    topics: [],
    ...overrides,
  };
}

function addCoverageSkills({
  graph: checked,
  missing: found,
}: {
  graph: GoalSkillGraph;
  missing: ReturnType<typeof missing>[];
}) {
  return applyGraphCoverage({
    coverage: { examWeights: [], missing: found, placements: [] },
    graph: checked,
  }).graph;
}

function addCoverageSkillsTo({
  graph: checked,
  missing: found,
  outline,
}: {
  graph: GoalSkillGraph;
  missing: ReturnType<typeof missing>[];
  outline: ExamOutline;
}) {
  return applyGraphCoverage({
    coverage: { examWeights: [], missing: found, placements: [] },
    graph: checked,
    outline,
  }).graph;
}

function reweightExamSkills({
  examWeights,
  graph: checked,
}: {
  examWeights: { examWeight: number; key: string }[];
  graph: GoalSkillGraph;
}) {
  return applyGraphCoverage({
    coverage: { examWeights, missing: [], placements: [] },
    graph: checked,
  }).graph;
}

describe("adding the skills a check found missing", () => {
  it("returns the graph unchanged when nothing is missing", () => {
    expect(addCoverageSkills({ graph, missing: [] })).toBe(graph);
  });

  it("places each missing skill after its last prerequisite, in its course, band, phase and the check's size", () => {
    const result = addCoverageSkills({
      graph,
      missing: [missing({ name: "Mitosis", prerequisites: ["cell", "dna"] })],
    });

    expect(result.skills.map((item) => item.key)).toStrictEqual([
      "cell",
      "dna",
      "coverage-1",
      "rna",
    ]);

    expect(result.skills[2]).toStrictEqual({
      area: "Biology",
      course: "bio",
      description: "Idea of Mitosis",
      estimatedLessons: 7,
      examWeight: null,
      key: "coverage-1",
      level: "intermediate",
      name: "Mitosis",
      phase: 2,
      prerequisites: ["cell", "dna"],
      topics: [],
    });
  });

  it("starts the graph with a missing skill that has no prerequisite", () => {
    const result = addCoverageSkills({
      graph,
      missing: [missing({ name: "Microscopes", prerequisites: [] })],
    });

    expect(result.skills[0]).toMatchObject({
      key: "coverage-1",
      name: "Microscopes",
      phase: 1,
      prerequisites: [],
    });
  });

  it("keeps the exam weight the check gave and never reuses a key the graph has", () => {
    const checked = addCoverageSkills({
      graph,
      missing: [missing({ examWeight: 4, name: "Mitosis", prerequisites: ["cell"] })],
    });

    const result = addCoverageSkills({
      graph: checked,
      missing: [missing({ examWeight: 2, name: "Meiosis", prerequisites: ["coverage-1"] })],
    });

    expect(result.skills.map((item) => [item.key, item.examWeight])).toStrictEqual([
      ["cell", null],
      ["coverage-1", 4],
      ["coverage-2", 2],
      ["dna", null],
      ["rna", null],
    ]);
  });
});

describe("correcting an exam's weights", () => {
  it("moves only the weights the check corrected and keeps every skill", () => {
    const weighted = { ...graph, skills: graph.skills.map((item) => ({ ...item, examWeight: 3 })) };

    const result = reweightExamSkills({
      examWeights: [
        { examWeight: 5, key: "dna" },
        { examWeight: 1, key: "rna" },
      ],
      graph: weighted,
    });

    expect(result.skills.map((item) => [item.key, item.examWeight])).toStrictEqual([
      ["cell", 3],
      ["dna", 5],
      ["rna", 1],
    ]);
  });

  it("returns the graph unchanged when no weight moves", () => {
    expect(reweightExamSkills({ examWeights: [], graph })).toBe(graph);
  });
});

const OUTLINE: ExamOutline = {
  name: "Concurso",
  notes: [],
  subjects: [
    {
      group: "Conhecimentos básicos (P1)",
      name: "Língua Portuguesa",
      questions: null,
      topics: ["1 Compreensão de textos", "2 Ortografia", "3 Crase", "4 Reescrita"],
      weight: null,
    },
    {
      group: "Conhecimentos específicos (P2)",
      name: "Ciência Política",
      questions: null,
      topics: ["1 Regimes políticos", "2 Sistemas eleitorais"],
      weight: null,
    },
  ],
  topicFrequency: [],
};

const examGraph: GoalSkillGraph = {
  ...graph,
  courses: [
    { countrySpecific: false, key: "pt", levels: ["intermediate"], title: "Português" },
    { countrySpecific: false, key: "pol", levels: ["beginner"], title: "Ciência Política" },
  ],
  skills: [
    skill({
      area: "Língua Portuguesa",
      course: "pt",
      examWeight: 4,
      key: "reading",
      topics: ["1 Compreensão de textos"],
    }),
    skill({ area: "Língua Portuguesa", course: "pt", examWeight: 4, key: "rewriting", topics: [] }),
    skill({
      area: "Ciência Política",
      course: "pol",
      examWeight: 2,
      key: "regimes",
      phase: 2,
      topics: ["1 Regimes políticos"],
    }),
  ],
};

describe(applyGraphCoverage, () => {
  it("places skills in the notice, adds the missing ones and gives every topic left a skill", () => {
    const { changed, graph: covered } = applyGraphCoverage({
      coverage: {
        examWeights: [],
        missing: [
          {
            area: "Ciência Política",
            description: "Comparar sistemas eleitorais",
            estimatedLessons: 4,
            examWeight: 2,
            name: "Comparar sistemas eleitorais",
            prerequisites: [],
            reference: "Concurso",
            syllabusLine: "2 Sistemas eleitorais",
            topics: ["2 Sistemas eleitorais"],
          },
        ],
        placements: [{ area: "Língua Portuguesa", key: "rewriting", topics: ["4 Reescrita"] }],
      },
      graph: examGraph,
      outline: OUTLINE,
    });

    expect(changed).toBe(true);

    expect(
      covered.skills.map(({ area, course, key, phase, topics }) => [
        key,
        area,
        course,
        phase,
        topics,
      ]),
    ).toStrictEqual([
      ["reading", "Língua Portuguesa", "pt", 1, ["1 Compreensão de textos"]],
      ["coverage-2", "Língua Portuguesa", "pt", 1, ["2 Ortografia"]],
      ["coverage-3", "Língua Portuguesa", "pt", 1, ["3 Crase"]],
      ["rewriting", "Língua Portuguesa", "pt", 1, ["4 Reescrita"]],
      ["regimes", "Ciência Política", "pol", 2, ["1 Regimes políticos"]],
      ["coverage-1", "Ciência Política", "pol", 2, ["2 Sistemas eleitorais"]],
    ]);

    expect(covered.skills.find((item) => item.key === "coverage-3")).toMatchObject({
      examWeight: 4,
      name: "Crase",
    });

    expect(needsCoverageCheck({ graph: covered, outline: OUTLINE, references: [] })).toBe(false);
  });

  it("never makes an added skill wait for an option of a choice the learner may not take", () => {
    const outline: ExamOutline = {
      ...OUTLINE,
      subjects: [
        ...OUTLINE.subjects,
        {
          choiceGroup: "Língua Estrangeira",
          group: null,
          name: "Língua Inglesa",
          questions: 5,
          topics: ["Leitura em inglês"],
          weight: null,
        },
      ],
    };

    const english = skill({ area: "Língua Inglesa", course: "pt", key: "english" });

    const covered = addCoverageSkillsTo({
      graph: { ...examGraph, skills: [...examGraph.skills, english] },
      missing: [
        missing({
          area: "Língua Portuguesa",
          name: "Reescrever frases",
          prerequisites: ["english"],
        }),
        missing({ area: "Língua Inglesa", name: "Ler manchetes", prerequisites: ["english"] }),
      ],
      outline,
    });

    const added = new Set(["Reescrever frases", "Ler manchetes"]);

    expect(
      covered.skills.flatMap((item) =>
        added.has(item.name) ? [[item.area, item.prerequisites]] : [],
      ),
    ).toStrictEqual([
      ["Língua Portuguesa", []],
      ["Língua Inglesa", ["english"]],
    ]);
  });

  it("puts a subject the graph has no skill of after the subject the notice lists before it", () => {
    const outline: ExamOutline = {
      ...OUTLINE,
      subjects: [
        OUTLINE.subjects[0],
        {
          choiceGroup: "Língua Estrangeira",
          group: null,
          name: "Língua Espanhola",
          questions: null,
          topics: ["Leitura em espanhol"],
          weight: null,
        },
        ...OUTLINE.subjects.slice(1),
      ].flatMap((subject) => (subject ? [subject] : [])),
    };

    const covered = addCoverageSkillsTo({
      graph: examGraph,
      missing: [
        missing({
          area: "Língua Espanhola",
          name: "Ler textos em espanhol",
          prerequisites: [],
          topics: ["Leitura em espanhol"],
        }),
      ],
      outline,
    });

    const areas = covered.skills.map((item) => item.area);

    expect(areas.indexOf("Língua Espanhola")).toBe(areas.lastIndexOf("Língua Portuguesa") + 1);
    expect(areas.indexOf("Ciência Política")).toBe(areas.indexOf("Língua Espanhola") + 1);

    expect(covered.skills.find((item) => item.area === "Língua Espanhola")).toMatchObject({
      course: "pt",
      phase: 1,
    });
  });

  it("asks for the check only with references or notice topics no skill teaches", () => {
    expect(needsCoverageCheck({ graph: examGraph, outline: OUTLINE, references: [] })).toBe(true);
    expect(needsCoverageCheck({ graph, references: [] })).toBe(false);
    expect(needsCoverageCheck({ graph, references: [{ text: "x", title: "y" }] })).toBe(true);
  });
});

describe("sizing a notice topic no skill teaches", () => {
  const sizedOutline: ExamOutline = {
    ...OUTLINE,
    subjects: [
      {
        group: null,
        name: "Língua Portuguesa",
        questions: null,
        topics: ["1 Leitura", "2 Crase", "3 Concordância", "4 Regência", "5 Pontuação"],
        weight: null,
      },
      {
        group: null,
        name: "Física",
        questions: null,
        topics: ["A. Leis da termodinâmica (e.g., entropia e calor)"],
        weight: null,
      },
    ],
  };

  const sizedGraph: GoalSkillGraph = {
    ...graph,
    skills: [
      skill({
        area: "Língua Portuguesa",
        estimatedLessons: 12,
        key: "reading",
        topics: ["1 Leitura", "2 Crase"],
      }),
      skill({
        area: "Língua Portuguesa",
        estimatedLessons: 9,
        key: "agreement",
        topics: ["3 Concordância"],
      }),
      skill({
        area: "Língua Portuguesa",
        estimatedLessons: 4,
        key: "verbs",
        topics: ["4 Regência"],
      }),
      skill({ area: "Matemática", estimatedLessons: 20, key: "algebra", topics: [] }),
    ],
  };

  function coverTopics(coverage: Parameters<typeof applyGraphCoverage>[0]["coverage"]["missing"]) {
    return applyGraphCoverage({
      coverage: { examWeights: [], missing: coverage, placements: [] },
      graph: sizedGraph,
      outline: sizedOutline,
    }).graph.skills;
  }

  it("gives it the median lessons per topic of its subject's own skills, not the ones coverage added", () => {
    const skills = coverTopics([
      missing({
        area: "Língua Portuguesa",
        name: "Usar a crase",
        prerequisites: [],
        topics: ["2 Crase"],
      }),
    ]);

    expect(skills.find((item) => item.topics.includes("5 Pontuação"))).toMatchObject({
      area: "Língua Portuguesa",
      estimatedLessons: 6,
      name: "Pontuação",
    });
  });

  it("reads lessons per topic after the check places the subject's skills on their topics", () => {
    const skills = applyGraphCoverage({
      coverage: {
        examWeights: [],
        missing: [],
        placements: [
          {
            area: "Língua Portuguesa",
            key: "grammar",
            topics: ["1 Leitura", "2 Crase", "3 Concordância"],
          },
        ],
      },
      graph: {
        ...graph,
        skills: [skill({ area: null, estimatedLessons: 12, key: "grammar", topics: [] })],
      },
      outline: { ...sizedOutline, subjects: sizedOutline.subjects.slice(0, 1) },
    }).graph.skills;

    expect(skills.find((item) => item.topics.includes("4 Regência"))).toMatchObject({
      estimatedLessons: 4,
    });
  });

  it("falls back to the whole graph's median when its subject has no skill yet", () => {
    const skills = coverTopics([]);

    expect(
      skills.find((item) =>
        item.topics.includes("A. Leis da termodinâmica (e.g., entropia e calor)"),
      ),
    ).toMatchObject({ area: "Física", estimatedLessons: 8, name: "Leis da termodinâmica" });
  });
});

describe(toTopicSkillName, () => {
  it.each([
    ["1.2 Estado, governo e administração", "Estado, governo e administração"],
    ["A. Thermodynamic laws (e.g., the first law)", "Thermodynamic laws"],
    ["b) Funções afins (por exemplo: tarifas de táxi)", "Funções afins"],
    ["IV - Controle externo", "Controle externo"],
    ["A Constituição de 1988", "A Constituição de 1988"],
    ["7", "7"],
  ])("names %j as %j", (topic, name) => {
    expect(toTopicSkillName(topic)).toBe(name);
  });
});
