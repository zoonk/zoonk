import { type ExamOutline } from "@zoonk/ai/tasks/v2/curriculum/exam-outline";
import { describe, expect, it } from "vitest";
import { applyGraphCoverage, needsCoverageCheck } from "./add-coverage-skills";
import { type GoalSkillGraph } from "./save-goal-skills";

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
  courses: [{ key: "bio", levels: ["beginner", "intermediate"], title: "Biology" }],
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
    examWeight: null,
    reference: "Syllabus",
    syllabusLine: `Line about ${overrides.name}`,
    topics: [],
    ...overrides,
  };
}

/** The graph with the missing skills a check found, and nothing else changed. */
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

/** The graph with the weights a check corrected, and nothing else changed. */
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

  it("places each missing skill right after its last prerequisite, in its course, band and phase", () => {
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
      estimatedLessons: 2,
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
    { key: "pt", levels: ["intermediate"], title: "Português" },
    { key: "pol", levels: ["beginner"], title: "Ciência Política" },
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

    // The notice's topics the check left out get a skill each, among their subject's skills in the
    // notice's order, with the subject's course, band, phase and usual weight.
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
      name: "3 Crase",
    });

    expect(needsCoverageCheck({ graph: covered, outline: OUTLINE, references: [] })).toBe(false);
  });

  it("asks for the check only with references or notice topics no skill teaches", () => {
    expect(needsCoverageCheck({ graph: examGraph, outline: OUTLINE, references: [] })).toBe(true);
    expect(needsCoverageCheck({ graph, references: [] })).toBe(false);
    expect(needsCoverageCheck({ graph, references: [{ text: "x", title: "y" }] })).toBe(true);
  });
});
