import { describe, expect, it } from "vitest";
import {
  EmptySkillGraphError,
  type RawSkillGraph,
  normalizeSkillGraph,
} from "./normalize-skill-graph";

type RawSkillGraphSkill = RawSkillGraph["skills"][number];

function rawSkill(overrides: Partial<RawSkillGraphSkill> & { key: string }): RawSkillGraphSkill {
  return {
    area: "",
    course: "math",
    description: `${overrides.key} description`,
    estimatedLessons: 10,
    examWeight: null,
    level: "beginner",
    name: `Use ${overrides.key}`,
    outcome: false,
    phase: 1,
    prerequisites: [],
    topics: [],
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

  it("keeps a career goal's outcome skills marked, also when a duplicate carried the mark", () => {
    const graph = normalizeSkillGraph(
      rawGraph([
        rawSkill({ key: "research", name: "Plan user interviews" }),
        rawSkill({ key: "case", name: "Write a case study" }),
        rawSkill({ key: "case-again", name: "write a case study", outcome: true }),
        rawSkill({ key: "interview", name: "Present a portfolio in an interview", outcome: true }),
      ]),
    );

    expect(graph.skills.map((skill) => [skill.key, skill.outcome])).toStrictEqual([
      ["research", false],
      ["case", true],
      ["interview", true],
    ]);
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

  it("names a learn skill's area as the model wrote it, or by its course when it wrote none", () => {
    const graph = normalizeSkillGraph(
      rawGraph([
        rawSkill({ area: " Álgebra ", key: "a" }),
        rawSkill({ key: "b", topics: ["S1.1"] }),
      ]),
    );

    expect(graph.skills.map((skill) => [skill.area, skill.topics])).toStrictEqual([
      ["Álgebra", []],
      ["Mathematics", []],
    ]);
  });

  it("puts an exam's skills in the notice's subjects and topics, word for word", () => {
    const outline = {
      name: "Concurso",
      notes: [],
      subjects: [
        {
          group: "Conhecimentos básicos (P1)",
          name: "Língua Portuguesa",
          questions: null,
          topics: ["Domínio da ortografia", "Emprego do sinal indicativo de crase"],
          weight: null,
        },
        {
          group: "Conhecimentos básicos (P1)",
          name: "Noções de Direito Constitucional e de Regimento Interno da Câmara dos Deputados",
          questions: null,
          topics: ["Princípios fundamentais", "Poder Legislativo"],
          weight: null,
        },
      ],
      topicFrequency: [],
    };

    const graph = normalizeSkillGraph(
      rawGraph([
        rawSkill({ area: "Português", key: "spelling", topics: ["S1.1", "S1.2", "S9.9"] }),
        rawSkill({ area: "Direito Constitucional", key: "principles", topics: [] }),
        rawSkill({ area: "Constitucional", key: "congress", topics: ["poder legislativo"] }),
        rawSkill({ area: "Estratégia de prova", key: "blanks", topics: ["S1.1"] }),
        rawSkill({ area: "Prova discursiva", key: "essay", topics: [] }),
      ]),
      outline,
    );

    const constitutional = outline.subjects[1]?.name;

    expect(graph.skills.map((skill) => [skill.key, skill.area, skill.topics])).toStrictEqual([
      [
        "spelling",
        "Língua Portuguesa",
        ["Domínio da ortografia", "Emprego do sinal indicativo de crase"],
      ],
      ["principles", constitutional, []],
      ["congress", constitutional, ["Poder Legislativo"]],
      ["blanks", "Língua Portuguesa", ["Domínio da ortografia"]],
      ["essay", "Prova discursiva", []],
    ]);
  });

  it("keeps the skills of the notice's written test whole, as outcomes of an exam goal", () => {
    const outline = {
      name: "Concurso",
      notes: [],
      subjects: [
        {
          group: "Conhecimentos básicos (P1)",
          name: "Língua Portuguesa",
          questions: null,
          topics: ["1 Ortografia"],
          weight: null,
        },
        {
          group: "Prova discursiva (P3)",
          name: "Prova Discursiva",
          questions: null,
          topics: ["Questões discursivas", "Peça técnica"],
          weight: null,
        },
      ],
      topicFrequency: [],
    };

    const graph = normalizeSkillGraph(
      rawGraph([
        rawSkill({ area: "Língua Portuguesa", key: "spelling", topics: ["S1.1"] }),
        rawSkill({ area: "Prova Discursiva", key: "piece", topics: ["S2.2"] }),
      ]),
      outline,
    );

    expect(graph.skills.map((skill) => [skill.key, skill.outcome])).toStrictEqual([
      ["spelling", false],
      ["piece", true],
    ]);
  });

  it("rejects a graph without courses, phases or skills", () => {
    expect(() => normalizeSkillGraph(rawGraph([rawSkill({ key: "a" })], { phases: [] }))).toThrow(
      EmptySkillGraphError,
    );

    expect(() => normalizeSkillGraph(rawGraph([]))).toThrow(EmptySkillGraphError);
  });
});
