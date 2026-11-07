import { randomUUID } from "node:crypto";
import { EmptySkillGraphError } from "@zoonk/ai/tasks/curriculum/empty-skill-graph-error";
import {
  generateSkillGraphFrame,
  generateSkillGraphSection,
  generateWholeSkillGraph,
} from "@zoonk/ai/tasks/curriculum/skill-graph-calls";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/identity/decision";
import { generateSearchTerms } from "@zoonk/ai/tasks/identity/search-terms";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { normalizeString } from "@zoonk/utils/string";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStepMetadata } from "workflow";
import { start } from "workflow/api";
import { taskResult } from "../_test-utils/recorded-outputs";
import { skillGraphTestWorkflow } from "../_test-utils/skill-graph-workflow";

vi.mock("@zoonk/ai/tasks/curriculum/skill-graph-calls", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateSkillGraphFrame: vi.fn(),
  generateSkillGraphSection: vi.fn(),
  generateWholeSkillGraph: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/identity/decision", () => ({ decideLibraryIdentity: vi.fn() }));
vi.mock("@zoonk/ai/tasks/identity/search-terms", () => ({ generateSearchTerms: vi.fn() }));

const SUBJECTS = ["Arithmetic", "Geometry", "Probability", "Statistics"];

const FRAME = {
  courses: [{ key: "math", levels: ["beginner" as const], title: "Mathematics" }],
  phases: [{ milestone: "Solve problems", title: "Foundations" }],
  sections: SUBJECTS.map((area, index) => ({
    area,
    course: "math",
    estimatedLessons: 4,
    phases: [1],
    skills: 1,
    subject: `S${index + 1}`,
  })),
};

async function examGoal() {
  const [user, blueprint] = await Promise.all([
    userFixture(),
    examBlueprintFixture({
      structure: {
        formats: ["multipleChoice"],
        subjects: SUBJECTS.map((name) => ({ name, topics: [`Apply ${name}`], weight: 0.25 })),
      },
    }),
  ]);

  return goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id });
}

function sectionResult(section: (typeof FRAME.sections)[number]) {
  const { data, ...result } = taskResult({
    skills: [
      {
        area: section.area,
        course: "math",
        description: `Apply ${section.area} to problems`,
        estimatedLessons: 4,
        examWeight: 1,
        key: section.area,
        level: "beginner" as const,
        name: `Apply ${section.area}`,
        outcome: false,
        phase: 1,
        prerequisites: [],
        topics: [`${section.subject}.1`],
      },
    ],
  });

  return { ...result, output: data };
}

describe("durable skill graph generation", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(generateSearchTerms).mockImplementation(async ({ subjects }) =>
      taskResult({ subjects: subjects.map(() => ({ terms: [] })) }),
    );

    vi.mocked(decideLibraryIdentity).mockResolvedValue({ match: null, verdicts: [] });
  });

  it("offers a synonymous course's skills and saves the same resolution with isolated model retries", async () => {
    const [goal, organization, skill] = await Promise.all([
      examGoal(),
      aiOrganizationFixture(),
      skillFixture(),
    ]);

    const word = `zq${randomUUID().replaceAll("-", "")}`;
    const title = `Língua Portuguesa ${word}`;

    const course = await courseFixture({
      normalizedTitle: normalizeString(title),
      organizationId: organization.id,
      title,
    });

    const otherExam = await examBlueprintFixture();

    await prisma.examSkillGraph.create({
      data: {
        examBlueprintId: otherExam.id,
        generatedAt: new Date(),
        graph: { phases: [], skills: [{ courseIds: [course.id], lessons: 4, skillId: skill.id }] },
        model: "test",
        promptVersion: "test",
        runId: randomUUID(),
      },
    });

    const { data, ...frame } = taskResult({
      ...FRAME,
      courses: [{ ...FRAME.courses[0]!, title: `Português ${word}` }],
    });

    vi.mocked(generateSkillGraphFrame).mockResolvedValue({ ...frame, output: data });
    const searchSteps: string[] = [];
    const decisionSteps: string[] = [];

    vi.mocked(generateSearchTerms).mockImplementation(async () => {
      searchSteps.push(getStepMetadata().stepId);
      return taskResult({ subjects: [{ terms: [word] }] });
    });

    vi.mocked(decideLibraryIdentity).mockImplementation(async () => {
      decisionSteps.push(getStepMetadata().stepId);

      if (decisionSteps.length === 1) {
        throw new Error("Identity provider unavailable");
      }

      return { match: { id: course.id, model: "test", probability: 0.99 }, verdicts: [] };
    });

    vi.mocked(generateSkillGraphSection).mockImplementation(async ({ params, part }) => {
      expect(params).toMatchObject({ librarySkills: true });
      expect(part.library).toContain(skill.name);
      return sectionResult(part.sections[0]!);
    });

    const run = await start(skillGraphTestWorkflow, [goal.id, false, true]);
    await expect(run.returnValue).resolves.toMatchObject({ courseIdsByKey: { math: course.id } });
    expect(searchSteps).toHaveLength(1);
    expect(decisionSteps).toHaveLength(2);
    expect(new Set(decisionSteps).size).toBe(1);
    expect(searchSteps[0]).not.toBe(decisionSteps[0]);
    expect(generateSkillGraphFrame).toHaveBeenCalledOnce();
    expect(generateSkillGraphSection).toHaveBeenCalledTimes(4);
  });

  it("makes each model call in a step of its own, so a failed section retries alone", async () => {
    const goal = await examGoal();
    const attempts = new Map<string, number>();
    const steps = new Map<string, string[]>();
    const { data, ...frame } = taskResult(FRAME);
    vi.mocked(generateSkillGraphFrame).mockResolvedValue({ ...frame, output: data });

    vi.mocked(generateSkillGraphSection).mockImplementation(async ({ part }) => {
      const section = part.sections[0]!;
      steps.set(section.area, [...(steps.get(section.area) ?? []), getStepMetadata().stepId]);
      const attempt = (attempts.get(section.area) ?? 0) + 1;
      attempts.set(section.area, attempt);

      if (section.area === "Geometry" && attempt === 1) {
        throw new Error("Provider unavailable");
      }

      return sectionResult(section);
    });

    const run = await start(skillGraphTestWorkflow, [goal.id]);
    await expect(run.returnValue).resolves.toMatchObject({ graph: { skills: expect.any(Array) } });
    expect(generateSkillGraphFrame).toHaveBeenCalledOnce();
    expect(new Set([...steps.values()].flat()).size).toBe(4);
    expect(new Set(steps.get("Geometry")).size).toBe(1);

    expect(Object.fromEntries(attempts)).toStrictEqual({
      Arithmetic: 1,
      Geometry: 2,
      Probability: 1,
      Statistics: 1,
    });
  });

  it("gives a flawed section's redraft its own step and retries only that redraft", async () => {
    const goal = await examGoal();
    const attempts = new Map<string, number>();
    const steps: string[] = [];
    const { data, ...frame } = taskResult(FRAME);
    vi.mocked(generateSkillGraphFrame).mockResolvedValue({ ...frame, output: data });

    vi.mocked(generateSkillGraphSection).mockImplementation(async ({ part }) => {
      const section = part.sections[0]!;
      const attempt = (attempts.get(section.area) ?? 0) + 1;
      attempts.set(section.area, attempt);
      const written = sectionResult(section);

      if (section.area !== "Arithmetic") {
        return written;
      }

      steps.push(getStepMetadata().stepId);

      if (attempt === 2) {
        throw new Error("Redraft provider unavailable");
      }

      return attempt === 1
        ? {
            ...written,
            output: {
              skills: written.output.skills.map((skill) => ({
                ...skill,
                description: "[insert example]",
              })),
            },
          }
        : written;
    });

    const run = await start(skillGraphTestWorkflow, [goal.id]);

    await expect(run.returnValue).resolves.toMatchObject({
      graph: {
        skills: expect.arrayContaining([
          expect.objectContaining({ description: "Apply Arithmetic to problems" }),
        ]),
      },
    });

    expect(generateSkillGraphFrame).toHaveBeenCalledOnce();

    expect(Object.fromEntries(attempts)).toStrictEqual({
      Arithmetic: 3,
      Geometry: 1,
      Probability: 1,
      Statistics: 1,
    });

    expect(steps[0]).not.toBe(steps[1]);
    expect(steps[1]).toBe(steps[2]);
  });

  it("redrafts a phase flaw with a new frame and independently durable sections", async () => {
    const goal = await examGoal();
    const steps = new Set<string>();

    vi.mocked(generateSkillGraphFrame).mockImplementation(async () => {
      steps.add(getStepMetadata().stepId);
      const first = vi.mocked(generateSkillGraphFrame).mock.calls.length === 1;

      const { data, ...frame } = taskResult({
        ...FRAME,
        phases: first ? [{ ...FRAME.phases[0]!, milestone: "[insert milestone]" }] : FRAME.phases,
      });

      return { ...frame, output: data };
    });

    vi.mocked(generateSkillGraphSection).mockImplementation(async ({ part }) => {
      steps.add(getStepMetadata().stepId);
      return sectionResult(part.sections[0]!);
    });

    const run = await start(skillGraphTestWorkflow, [goal.id]);

    await expect(run.returnValue).resolves.toMatchObject({
      graph: { phases: [expect.objectContaining({ milestone: "Solve problems" })] },
    });

    expect(generateSkillGraphFrame).toHaveBeenCalledTimes(2);
    expect(generateSkillGraphSection).toHaveBeenCalledTimes(8);
    expect(steps.size).toBe(10);
  });

  it("keeps the private graph's empty-output fallback across step serialization", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ kind: "learn", userId: user.id });
    const written = sectionResult(FRAME.sections[0]!);

    const graph = {
      courses: FRAME.courses,
      estimatedHours: 0.4,
      phases: FRAME.phases.map((phase) => ({ ...phase, estimatedHours: 0.4 })),
      skills: written.output.skills,
    };

    vi.mocked(generateWholeSkillGraph).mockImplementation(async ({ model }) => {
      if (model) {
        throw new EmptySkillGraphError();
      }

      return { ...taskResult(graph), repaired: [] };
    });

    const run = await start(skillGraphTestWorkflow, [goal.id, true]);
    await expect(run.returnValue).resolves.toMatchObject({ graph });

    expect(
      vi.mocked(generateWholeSkillGraph).mock.calls.map(([params]) => params.model),
    ).toStrictEqual(["google/gemini-3.8-flash", undefined]);
  });

  it.each(["learn", "language"] as const)(
    "keeps a %s goal on the whole-graph path",
    async (kind) => {
      const user = await userFixture();

      const goal = await goalFixture({
        kind,
        targetLanguage: kind === "language" ? "es" : null,
        userId: user.id,
      });

      const written = sectionResult(FRAME.sections[0]!);

      const graph = {
        courses: FRAME.courses,
        estimatedHours: 0.4,
        phases: FRAME.phases.map((phase) => ({ ...phase, estimatedHours: 0.4 })),
        skills: written.output.skills,
      };

      vi.mocked(generateWholeSkillGraph).mockResolvedValue({ ...taskResult(graph), repaired: [] });

      const run = await start(skillGraphTestWorkflow, [goal.id]);
      await expect(run.returnValue).resolves.toMatchObject({ graph });
      expect(generateSkillGraphFrame).not.toHaveBeenCalled();
      expect(generateSkillGraphSection).not.toHaveBeenCalled();

      expect(generateWholeSkillGraph).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ goalKind: kind, serviceTier: "priority" }),
      );
    },
  );
});
