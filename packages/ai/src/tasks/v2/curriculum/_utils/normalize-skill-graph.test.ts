import { describe, expect, it } from "vitest";
import {
  EmptySkillGraphError,
  type RawSkillGraph,
  normalizeSkillGraph,
} from "./normalize-skill-graph";

type RawSkillGraphSkill = RawSkillGraph["skills"][number];

function rawSkill(overrides: Partial<RawSkillGraphSkill> & { key: string }): RawSkillGraphSkill {
  return {
    course: "math",
    description: `${overrides.key} description`,
    estimatedLessons: 10,
    examWeight: null,
    level: "beginner",
    name: `Use ${overrides.key}`,
    phase: 1,
    prerequisites: [],
    ...overrides,
  };
}

function rawGraph(
  skills: RawSkillGraphSkill[],
  overrides: Partial<RawSkillGraph> = {},
): RawSkillGraph {
  return {
    courses: [
      { key: "math", levels: ["beginner"], title: " Mathematics " },
      { key: "physics", levels: ["beginner"], title: "Classical mechanics" },
    ],
    phases: [
      { milestone: "Solve equations", title: "The math physics uses" },
      { milestone: "Predict motion", title: "Classical physics" },
      { milestone: "Unused", title: "Empty phase" },
    ],
    skills,
    ...overrides,
  };
}

describe(normalizeSkillGraph, () => {
  it("merges duplicate skills by key or name and keeps edges pointing at the survivor", () => {
    const graph = normalizeSkillGraph(
      rawGraph([
        rawSkill({ key: "algebra", name: "Solve linear equations" }),
        rawSkill({
          key: "equations",
          name: "solve LINEAR equations ",
          prerequisites: ["fractions"],
        }),
        rawSkill({ key: "fractions" }),
        rawSkill({ course: "physics", key: "motion", prerequisites: ["equations"] }),
      ]),
    );

    expect(graph.skills.map((skill) => skill.key)).toStrictEqual([
      "fractions",
      "algebra",
      "motion",
    ]);

    expect(graph.skills.find((skill) => skill.key === "algebra")?.prerequisites).toStrictEqual([
      "fractions",
    ]);

    expect(graph.skills.find((skill) => skill.key === "motion")?.prerequisites).toStrictEqual([
      "algebra",
    ]);
  });

  it("drops prerequisites that point nowhere, at the skill itself or close a cycle", () => {
    const graph = normalizeSkillGraph(
      rawGraph([
        rawSkill({ key: "a", prerequisites: ["b", "missing", "a"] }),
        rawSkill({ key: "b", prerequisites: ["a"] }),
      ]),
    );

    expect(graph.skills.map((skill) => [skill.key, skill.prerequisites])).toStrictEqual([
      ["b", []],
      ["a", ["b"]],
    ]);
  });

  it("moves skills after their prerequisites' phases and removes empty phases", () => {
    const graph = normalizeSkillGraph(
      rawGraph([
        rawSkill({ key: "vectors", phase: 2 }),
        rawSkill({ course: "physics", key: "forces", phase: 1, prerequisites: ["vectors"] }),
        rawSkill({ key: "fractions", phase: 9 }),
      ]),
    );

    expect(graph.phases.map((phase) => phase.title)).toStrictEqual([
      "Classical physics",
      "Empty phase",
    ]);

    expect(graph.skills.map((skill) => [skill.key, skill.phase])).toStrictEqual([
      ["vectors", 1],
      ["forces", 1],
      ["fractions", 2],
    ]);
  });

  it("sizes phases in hours of study from their lessons", () => {
    const graph = normalizeSkillGraph(
      rawGraph([
        rawSkill({ estimatedLessons: 25, key: "a", phase: 1 }),
        rawSkill({ estimatedLessons: 15.4, key: "b", phase: 1 }),
        rawSkill({ estimatedLessons: 0, key: "c", phase: 2 }),
      ]),
    );

    expect(graph.skills.map((skill) => skill.estimatedLessons)).toStrictEqual([25, 15, 1]);
    expect(graph.phases.map((phase) => phase.estimatedHours)).toStrictEqual([4, 0.1]);
    expect(graph.estimatedHours).toBe(4.1);
  });

  it("keeps exam weights between 1 and 5 and leaves them empty outside exams", () => {
    const graph = normalizeSkillGraph(
      rawGraph([
        rawSkill({ examWeight: 9, key: "a" }),
        rawSkill({ examWeight: 0, key: "b" }),
        rawSkill({ key: "c" }),
      ]),
    );

    expect(graph.skills.map((skill) => skill.examWeight)).toStrictEqual([5, 1, null]);
  });

  it("keeps only courses with skills and lists every level band their skills use", () => {
    const graph = normalizeSkillGraph(
      rawGraph([
        rawSkill({ key: "a", level: "intermediate" }),
        rawSkill({ course: "unknown", key: "b" }),
      ]),
    );

    expect(graph.courses).toStrictEqual([
      { key: "math", levels: ["beginner", "intermediate"], title: "Mathematics" },
    ]);

    expect(graph.skills.map((skill) => skill.course)).toStrictEqual(["math", "math"]);
  });

  it("rejects a graph without courses, phases or skills", () => {
    expect(() => normalizeSkillGraph(rawGraph([rawSkill({ key: "a" })], { phases: [] }))).toThrow(
      EmptySkillGraphError,
    );

    expect(() => normalizeSkillGraph(rawGraph([]))).toThrow(EmptySkillGraphError);
  });
});
