import { randomUUID } from "node:crypto";
import { type ExamOutline } from "@zoonk/ai/tasks/curriculum/exam-outline";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { skillFixture, skillsFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { normalizeString } from "@zoonk/utils/string";
import { describe, expect, it } from "vitest";
import { redraftFlawedSections } from "../../../../ai/src/tasks/curriculum/_utils/graph-drafts";
import {
  type RawSkillGraph,
  normalizeSkillGraph,
} from "../../../../ai/src/tasks/curriculum/_utils/normalize-skill-graph";
import { mockDecision, mockSearchTerms, uniqueWord } from "../identity/_test-utils/identity-mocks";
import { applyGraphCoverage } from "./add-coverage-skills";
import { findExamLibrary } from "./exam-library-skills";
import { findOrCreateGoalCourse } from "./find-or-create-goal-course";

const scope = { language: "pt", ownerId: null, targetLanguage: null };
const provenance = { generatedAt: new Date(), model: "test", promptVersion: "test", runId: "test" };

const frame: Pick<RawSkillGraph, "courses" | "phases"> = {
  courses: [{ key: "math", levels: ["beginner"], title: "Matemática" }],
  phases: [{ milestone: "Preparação inicial", title: "Fundamentos" }],
};

function rawSkill(
  attrs: Partial<RawSkillGraph["skills"][number]> = {},
): RawSkillGraph["skills"][number] {
  return {
    area: "Matemática",
    course: "math",
    description: "Representar uma fração como um número decimal.",
    estimatedLessons: 4,
    examWeight: 3,
    key: "forward",
    level: "beginner",
    name: "Converter frações em decimais",
    outcome: false,
    phase: 1,
    prerequisites: [],
    topics: [],
    ...attrs,
  };
}

async function saveExamGraph(placed: readonly { courseId: string; skillId: string }[]) {
  const blueprint = await examBlueprintFixture({ language: "pt" });

  await prisma.examSkillGraph.create({
    data: {
      ...provenance,
      examBlueprintId: blueprint.id,
      graph: {
        phases: [{ milestone: "Base", name: "Base" }],
        skills: placed.map(({ courseId, skillId }) => ({
          area: "Matemática",
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

describe("shared exam fixes adversarial review", () => {
  it("does not rewrite a valid new conversion and its reused inverse as duplicate abilities", async () => {
    const id = randomUUID();

    const written = [
      { output: { skills: [rawSkill(), rawSkill({ key: "reverse", reuse: "L1" })] } },
    ];

    const result = await redraftFlawedSections({
      frame,
      library: [
        {
          course: "math",
          description: "Representar um número decimal como uma fração.",
          id,
          lessons: 4,
          level: "beginner",
          name: "Converter decimais em frações",
          prerequisiteIds: [],
        },
      ],
      params: { goalKind: "exam" },
      rewrite: async () => written[0]!,
      written,
    });

    expect(result.data.skills).toHaveLength(2);
    expect(result.rewrites).toHaveLength(0);
  });

  it("repairs a discipline whose entire skill set was omitted from the draft", () => {
    const area = "Conhecimentos em Direito";

    const outline: ExamOutline = {
      name: "Concurso",
      notes: [],
      subjects: [
        {
          group: null,
          name: area,
          questions: null,
          topics: ["1. Crimes de falsidade documental", "2. Atos administrativos"],
          weight: null,
        },
      ],
      topicFrequency: [],
    };

    const graph = normalizeSkillGraph(
      {
        courses: [
          { key: "administrative", levels: ["beginner"], title: "Direito Administrativo" },
          { key: "criminal", levels: ["beginner"], title: "Direito Penal" },
        ],
        phases: frame.phases,
        skills: [
          rawSkill({
            area,
            course: "administrative",
            key: "acts",
            name: "Aplicar regras de atos administrativos",
            topics: ["2. Atos administrativos"],
          }),
        ],
      },
      outline,
    );

    const covered = applyGraphCoverage({
      coverage: {
        examWeights: [],
        missing: [
          {
            area,
            course: "criminal",
            description: "Reconhecer os crimes contra a fé pública em documentos.",
            examWeight: 3,
            name: "Identificar crimes de falsidade documental",
            prerequisites: [],
            reference: "Concurso",
            syllabusLine: "1. Crimes de falsidade documental",
            topics: ["1. Crimes de falsidade documental"],
          },
        ],
        placements: [],
      },
      graph,
      outline,
    });

    expect(
      covered.graph.skills.find(
        (skill) => skill.name === "Identificar crimes de falsidade documental",
      )?.course,
    ).toBe("criminal");
  });

  it("terminates on a prerequisite cycle and filters private and other-language rows", async () => {
    const [course, exam, applied, foundation, hidden, foreign] = await Promise.all([
      courseFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
      skillFixture({ language: "pt" }),
      skillFixture({ language: "pt" }),
      skillFixture({ language: "pt", visibility: "private" }),
      skillFixture({ language: "en" }),
    ]);

    await prisma.skillPrerequisite.createMany({
      data: [
        { prerequisiteId: foundation.id, skillId: applied.id },
        { prerequisiteId: applied.id, skillId: foundation.id },
        { prerequisiteId: hidden.id, skillId: applied.id },
        { prerequisiteId: foreign.id, skillId: applied.id },
      ],
    });

    await saveExamGraph(
      [applied, foundation, hidden, foreign].map((skill) => ({
        courseId: course.id,
        skillId: skill.id,
      })),
    );

    const { skills: listed } = await findExamLibrary({
      courseIdsByKey: { [course.id]: course.id },
      examBlueprintId: exam.id,
      language: "pt",
    });

    expect(listed.map((skill) => skill.id).toSorted()).toStrictEqual(
      [applied.id, foundation.id].toSorted(),
    );
  });

  it("loads a prerequisite chain beyond the graph validator's maximum depth", async () => {
    const [course, outside, exam, chain] = await Promise.all([
      courseFixture({ language: "pt" }),
      courseFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
      skillsFixture(
        Array.from({ length: 128 }, (_, index) => `Chain ${index} ${randomUUID()}`),
        { language: "pt" },
      ),
    ]);

    await prisma.skillPrerequisite.createMany({
      data: chain
        .slice(1)
        .map((skill, index) => ({ prerequisiteId: chain[index]!.id, skillId: skill.id })),
    });

    await saveExamGraph(
      chain.map((skill, index) => ({
        courseId: index === chain.length - 1 ? course.id : outside.id,
        skillId: skill.id,
      })),
    );

    const { skills: listed } = await findExamLibrary({
      courseIdsByKey: { [course.id]: course.id },
      examBlueprintId: exam.id,
      language: "pt",
    });

    expect(listed).toHaveLength(chain.length);
  });

  it("matches case, whitespace and accents in exact catalog titles", async () => {
    const [organization, exam] = await Promise.all([
      aiOrganizationFixture(),
      examBlueprintFixture({ language: "pt" }),
    ]);

    const title = `Língua Portuguesa ${randomUUID()}`;

    const [course, skill] = await Promise.all([
      courseFixture({
        language: "pt",
        normalizedTitle: normalizeString(title),
        organizationId: organization.id,
        title,
      }),
      skillFixture({ language: "pt" }),
    ]);

    await saveExamGraph([{ courseId: course.id, skillId: skill.id }]);

    const saved = await findOrCreateGoalCourse({
      format: "core",
      provenance,
      scope,
      title: `  ${normalizeString(title).toUpperCase().replaceAll(" ", "  ")}  `,
    });

    const library = await findExamLibrary({
      courseIdsByKey: { portuguese: saved.course.id },
      examBlueprintId: exam.id,
      language: scope.language,
    });

    expect(library.skills.map((entry) => entry.id)).toStrictEqual([skill.id]);
  });

  it("keeps a foundation taught in the Library before any exam explicitly places it", async () => {
    const [organization, exam, mathematics, applied, foundation] = await Promise.all([
      aiOrganizationFixture(),
      examBlueprintFixture({ language: "pt" }),
      courseFixture({ language: "pt", title: `Matemática ${randomUUID()}` }),
      skillFixture({ language: "pt", name: "Calcular velocidades em movimentos uniformes" }),
      skillFixture({ language: "pt", name: "Resolver equações lineares" }),
    ]);

    const title = `Física ${randomUUID()}`;

    const physics = await courseFixture({
      language: "pt",
      normalizedTitle: normalizeString(title),
      organizationId: organization.id,
      title,
    });

    const chapter = await libraryChapterFixture({ homeCourseId: mathematics.id, language: "pt" });

    await Promise.all([
      courseChapterFixture({ chapterId: chapter.id, courseId: mathematics.id }),
      chapterSkillFixture({ chapterId: chapter.id, skillId: foundation.id }),
      prisma.skillPrerequisite.create({
        data: { prerequisiteId: foundation.id, skillId: applied.id },
      }),
    ]);

    await saveExamGraph([{ courseId: physics.id, skillId: applied.id }]);

    const library = await findExamLibrary({
      courseIdsByKey: { physics: physics.id },
      examBlueprintId: exam.id,
      language: scope.language,
    });

    expect(library.skills.find((skill) => skill.id === applied.id)?.prerequisiteIds).toContain(
      foundation.id,
    );

    expect(library.skills.map((skill) => skill.id)).toContain(foundation.id);
  });

  it("offers the skills from the synonymous catalog course that saving resolves", async () => {
    const word = uniqueWord();

    const [organization, exam] = await Promise.all([
      aiOrganizationFixture(),
      examBlueprintFixture({ language: "pt" }),
    ]);

    const [course, skill] = await Promise.all([
      courseFixture({
        language: "pt",
        normalizedTitle: normalizeString(`Língua Portuguesa ${word}`),
        organizationId: organization.id,
        title: `Língua Portuguesa ${word}`,
      }),
      skillFixture({ language: "pt" }),
    ]);

    await saveExamGraph([{ courseId: course.id, skillId: skill.id }]);
    const title = `Português ${word}`;

    mockSearchTerms([word]);
    mockDecision(course.id);
    const saved = await findOrCreateGoalCourse({ format: "core", provenance, scope, title });

    const library = await findExamLibrary({
      courseIdsByKey: { portuguese: saved.course.id },
      examBlueprintId: exam.id,
      language: scope.language,
    });

    expect(saved).toMatchObject({ course: { id: course.id }, created: false });
    expect(library.skills.map((entry) => entry.id)).toContain(skill.id);
  });
});
