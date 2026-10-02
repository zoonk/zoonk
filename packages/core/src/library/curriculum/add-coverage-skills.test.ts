import { describe, expect, it } from "vitest";
import { addCoverageSkills, reweightExamSkills } from "./add-coverage-skills";
import { type GoalSkillGraph } from "./save-goal-skills";

function skill(overrides: Partial<GoalSkillGraph["skills"][number]> & { key: string }) {
  return {
    course: "bio",
    description: `Idea ${overrides.key}`,
    estimatedLessons: 3,
    examWeight: null,
    level: "beginner" as const,
    name: `Skill ${overrides.key}`,
    phase: 1,
    prerequisites: [],
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

function missing(overrides: { examWeight?: number; name: string; prerequisites: string[] }) {
  return {
    description: `Idea of ${overrides.name}`,
    examWeight: null,
    reference: "Syllabus",
    syllabusLine: `Line about ${overrides.name}`,
    ...overrides,
  };
}

describe(addCoverageSkills, () => {
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
      course: "bio",
      description: "Idea of Mitosis",
      estimatedLessons: 2,
      examWeight: null,
      key: "coverage-1",
      level: "intermediate",
      name: "Mitosis",
      phase: 2,
      prerequisites: ["cell", "dna"],
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

describe(reweightExamSkills, () => {
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
