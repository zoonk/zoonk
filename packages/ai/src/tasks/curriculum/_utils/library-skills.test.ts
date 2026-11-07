import { describe, expect, it } from "vitest";
import {
  type ExamLibrary,
  type LibrarySkill,
  addLibraryCourses,
  applyLibraryReuse,
  formatLibrarySkills,
} from "./library-skills";
import { type RawSkillGraph, normalizeSkillGraph } from "./normalize-skill-graph";

type RawSkill = RawSkillGraph["skills"][number];

const library: LibrarySkill[] = [
  {
    course: "constitucional",
    description: "Saber o que fundamenta a República",
    id: "base-id",
    lessons: 6,
    level: "beginner",
    name: "Identificar os fundamentos da República",
    prerequisiteIds: [],
  },
  {
    course: "constitucional",
    description: "Julgar se uma restrição a um direito é válida",
    id: "rights-id",
    lessons: 9,
    level: "intermediate",
    name: "Aplicar direitos e garantias fundamentais",
    prerequisiteIds: ["base-id", "elsewhere-id"],
  },
];

function rawSkill(attrs: Partial<RawSkill>): RawSkill {
  return {
    area: "Noções de Direito Constitucional",
    course: "direito",
    description: "Written by the model",
    estimatedLessons: 3,
    examWeight: 4,
    key: "s1-skill",
    level: "advanced",
    name: "Written name",
    outcome: false,
    phase: 2,
    prerequisites: ["s1-other"],
    topics: ["S1.2"],
    ...attrs,
  };
}

describe(applyLibraryReuse, () => {
  it("keeps what the Library says a reused skill is and adds only the exam's area, topics, phase and weight", () => {
    const [reused] = applyLibraryReuse({ library, skills: [rawSkill({ reuse: "l2" })] });

    expect(reused).toMatchObject({
      area: "Noções de Direito Constitucional",
      course: "constitucional",
      description: "Julgar se uma restrição a um direito é válida",
      estimatedLessons: 9,
      examWeight: 4,
      level: "intermediate",
      libraryId: "rights-id",
      name: "Aplicar direitos e garantias fundamentais",
      phase: 2,
      topics: ["S1.2"],
    });
  });

  it("brings a reused skill's listed prerequisites along and links them, never the model's own", () => {
    const skills = applyLibraryReuse({ library, skills: [rawSkill({ reuse: "L2" })] });
    const prerequisite = skills.find((skill) => skill.libraryId === "base-id");

    expect(skills).toHaveLength(2);
    expect(prerequisite).toMatchObject({ area: "Noções de Direito Constitucional", topics: [] });
    expect(skills[0]?.prerequisites).toStrictEqual([prerequisite?.key]);
  });

  it("links a prerequisite another section already reuses instead of adding it twice", () => {
    const skills = applyLibraryReuse({
      library,
      skills: [rawSkill({ reuse: "L2" }), rawSkill({ key: "s2-base", reuse: "L1" })],
    });

    expect(skills).toHaveLength(2);
    expect(skills[0]?.prerequisites).toStrictEqual(["s2-base"]);
  });

  it("writes a skill the model gave an unknown or no reuse id as a new one", () => {
    const skills = [rawSkill({ reuse: "L9" }), rawSkill({ key: "s1-new", reuse: null })];

    expect(applyLibraryReuse({ library, skills })).toStrictEqual(skills);
  });
});

describe(addLibraryCourses, () => {
  it("keeps a reused skill's foundation from another discipline in that discipline's course", () => {
    const exam: ExamLibrary = {
      courses: [{ key: "math-id", title: "Matemática" }],
      skills: [
        {
          course: "math-id",
          description: "Isolar a incógnita",
          id: "equations-id",
          lessons: 4,
          level: "beginner",
          name: "Resolver equações lineares",
          prerequisiteIds: [],
        },
        {
          course: "physics",
          description: "Relacionar distância e tempo",
          id: "speeds-id",
          lessons: 5,
          level: "intermediate",
          name: "Calcular velocidades em movimentos uniformes",
          prerequisiteIds: ["equations-id"],
        },
      ],
    };

    const frame = addLibraryCourses({
      frame: {
        courses: [{ key: "physics", levels: ["intermediate"], title: "Física" }],
        phases: [{ milestone: "Base", title: "Base" }],
      },
      library: exam,
    });

    const graph = normalizeSkillGraph({
      ...frame,
      skills: applyLibraryReuse({
        library: exam.skills,
        skills: [rawSkill({ course: "physics", reuse: "L2" })],
      }),
    });

    expect(graph.courses.map((course) => [course.key, course.title])).toStrictEqual([
      ["physics", "Física"],
      ["math-id", "Matemática"],
    ]);

    expect(graph.skills.find((skill) => skill.libraryId === "equations-id")?.course).toBe(
      "math-id",
    );
  });
});

describe(formatLibrarySkills, () => {
  it("lists each course's skills under short ids, with the prerequisites the list has", () => {
    expect(formatLibrarySkills(library)).toBe(
      [
        "LIBRARY_SKILLS:",
        "- constitucional:",
        "  - L1: Identificar os fundamentos da República (beginner, 6 lessons): Saber o que fundamenta a República",
        "  - L2: Aplicar direitos e garantias fundamentais (intermediate, 9 lessons; needs L1): Julgar se uma restrição a um direito é válida",
      ].join("\n"),
    );
  });
});
