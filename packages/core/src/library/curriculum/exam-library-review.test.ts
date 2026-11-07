import { randomUUID } from "node:crypto";
import { type ExamOutline } from "@zoonk/ai/tasks/curriculum/exam-outline";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it } from "vitest";
import {
  type LibrarySkill,
  applyLibraryReuse,
} from "../../../../ai/src/tasks/curriculum/_utils/library-skills";
import {
  type RawSkillGraph,
  normalizeSkillGraph,
} from "../../../../ai/src/tasks/curriculum/_utils/normalize-skill-graph";
import { applyGraphCoverage } from "./add-coverage-skills";
import { loadExamLibrarySkills } from "./exam-library-skills";

const provenance = { generatedAt: new Date(), model: "test", promptVersion: "test", runId: "test" };

async function saveExamGraph(placed: readonly { courseId: string; skillId: string }[]) {
  const blueprint = await examBlueprintFixture({ language: "pt" });

  await prisma.examSkillGraph.create({
    data: {
      ...provenance,
      examBlueprintId: blueprint.id,
      graph: {
        phases: [{ milestone: "Base", name: "Base" }],
        skills: placed.map(({ courseId, skillId }) => ({
          area: "Conhecimentos específicos",
          courseIds: [courseId],
          lessons: 4,
          name: "Fixture skill",
          phase: 0,
          skillId,
          topics: [],
          weight: 3,
        })),
      },
      runId: randomUUID(),
    },
  });
}

function rawReuse({
  index,
  name,
}: {
  index: number;
  name: string;
}): RawSkillGraph["skills"][number] {
  return {
    area: "Conhecimentos específicos",
    course: "subject",
    description: "Reused from the Library",
    estimatedLessons: 4,
    examWeight: 3,
    key: `skill-${index}`,
    level: "intermediate",
    name,
    outcome: false,
    phase: 1,
    prerequisites: [],
    reuse: `L${index + 1}`,
    topics: [`S1.${index + 1}`],
  };
}

function toGraph(library: LibrarySkill[]) {
  return normalizeSkillGraph({
    courses: [{ key: "subject", levels: ["intermediate"], title: "Subject" }],
    phases: [{ milestone: "Base", title: "Base" }],
    skills: applyLibraryReuse({
      library,
      skills: library.map((skill, index) => rawReuse({ index, name: skill.name })),
    }),
  });
}

describe("shared exam Library review reproductions", () => {
  it("places a repaired topic in its discipline when a notice subject combines disciplines", () => {
    const area = "Conhecimentos em Direito";

    const outline: ExamOutline = {
      name: "Concurso",
      notes: [],
      subjects: [
        {
          group: null,
          name: area,
          questions: null,
          topics: ["1. Crimes de falsidade documental", "2. Atos administrativos", "3. Peculato"],
          weight: null,
        },
      ],
      topicFrequency: [],
    };

    const graph = normalizeSkillGraph(
      {
        courses: [
          { key: "administrative", levels: ["intermediate"], title: "Direito Administrativo" },
          { key: "criminal", levels: ["intermediate"], title: "Direito Penal" },
        ],
        phases: [{ milestone: "Base", title: "Base" }],
        skills: [
          {
            ...rawReuse({ index: 0, name: "Aplicar regras de atos administrativos" }),
            area,
            course: "administrative",
            reuse: null,
            topics: ["2. Atos administrativos"],
          },
          {
            ...rawReuse({ index: 1, name: "Distinguir modalidades de peculato" }),
            area,
            course: "criminal",
            reuse: null,
            topics: ["3. Peculato"],
          },
        ],
      },
      outline,
    );

    expect(graph.skills.flatMap((skill) => skill.topics)).toHaveLength(2);

    const covered = applyGraphCoverage({
      coverage: { examWeights: [], missing: [], placements: [] },
      graph,
      outline,
    });

    expect(
      covered.graph.skills.find((skill) => skill.name === "1. Crimes de falsidade documental")
        ?.course,
    ).toBe("criminal");
  });

  it("keeps a reused skill's prerequisite when another discipline teaches it", async () => {
    const [physics, mathematics, foundation, applied, newExam] = await Promise.all([
      courseFixture({ language: "pt", title: "Física" }),
      courseFixture({ language: "pt", title: "Matemática" }),
      skillFixture({ language: "pt", name: "Resolver equações lineares" }),
      skillFixture({ language: "pt", name: "Calcular velocidades em movimentos uniformes" }),
      examBlueprintFixture({ language: "pt" }),
    ]);

    await prisma.skillPrerequisite.create({
      data: { prerequisiteId: foundation.id, skillId: applied.id },
    });

    await saveExamGraph([
      { courseId: mathematics.id, skillId: foundation.id },
      { courseId: physics.id, skillId: applied.id },
    ]);

    const listed = await loadExamLibrarySkills({
      courseIds: [physics.id],
      examBlueprintId: newExam.id,
      language: "pt",
    });

    expect(listed.find((skill) => skill.id === applied.id)?.prerequisiteIds).toContain(
      foundation.id,
    );

    const graph = toGraph(
      listed.map(({ courseId: _courseId, ...skill }) => ({ ...skill, course: "subject" })),
    );

    expect(graph.skills.map((skill) => skill.libraryId)).toContain(foundation.id);
  });

  it("never assigns a reused row to a distinct fresh skill with the same name words", async () => {
    const [course, reverse, newExam] = await Promise.all([
      courseFixture({ language: "pt", title: "Matemática" }),
      skillFixture({
        description: "Representar um número decimal como uma fração.",
        language: "pt",
        name: "Converter decimais em frações",
      }),
      examBlueprintFixture({ language: "pt" }),
    ]);

    await saveExamGraph([{ courseId: course.id, skillId: reverse.id }]);

    const listed = await loadExamLibrarySkills({
      courseIds: [course.id],
      examBlueprintId: newExam.id,
      language: "pt",
    });

    expect(listed).toHaveLength(1);

    const library = listed.map(({ courseId: _courseId, ...skill }) => ({
      ...skill,
      course: "subject",
    }));

    const forward = {
      ...rawReuse({ index: 1, name: "Converter frações em decimais" }),
      description: "Representar uma fração como um número decimal.",
      reuse: null,
    };

    const graph = normalizeSkillGraph({
      courses: [{ key: "subject", levels: ["intermediate"], title: "Matemática" }],
      phases: [{ milestone: "Base", title: "Base" }],
      skills: applyLibraryReuse({
        library,
        skills: [forward, rawReuse({ index: 0, name: reverse.name })],
      }),
    });

    expect(graph.skills.find((skill) => skill.libraryId === reverse.id)?.name).toBe(reverse.name);
  });
});
