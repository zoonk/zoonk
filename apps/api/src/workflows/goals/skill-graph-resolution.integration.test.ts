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
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { normalizeString } from "@zoonk/utils/string";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

function skill(area: string, course: string) {
  return {
    area,
    course,
    description: `Apply ${area} to problems`,
    estimatedLessons: 4,
    examWeight: 1,
    key: area.toLowerCase(),
    level: "beginner" as const,
    name: `Apply ${area}`,
    outcome: false,
    phase: 1,
    prerequisites: [],
    topics: [],
  };
}

describe("skill graph retries and course resolution", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(generateSearchTerms).mockImplementation(async ({ subjects }) =>
      taskResult({ subjects: subjects.map(() => ({ terms: [] })) }),
    );

    vi.mocked(decideLibraryIdentity).mockResolvedValue({ match: null, verdicts: [] });
  });

  it("retries a shared graph whose default-model call came back empty", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ kind: "learn", userId: user.id });
    const written = skill("Arithmetic", "math");

    const graph = {
      courses: [{ key: "math", levels: ["beginner" as const], title: "Mathematics" }],
      estimatedHours: 0.4,
      phases: [{ estimatedHours: 0.4, milestone: "Solve problems", title: "Foundations" }],
      skills: [written],
    };

    // `generateWholeSkillGraph` throws this when the model's answer normalizes to nothing.
    vi.mocked(generateWholeSkillGraph)
      .mockRejectedValueOnce(new EmptySkillGraphError())
      .mockResolvedValue({ ...taskResult(graph), repaired: [] });

    const run = await start(skillGraphTestWorkflow, [goal.id]);

    await expect(run.returnValue).resolves.toMatchObject({ graph: { skills: [written] } });
    expect(generateWholeSkillGraph).toHaveBeenCalledTimes(2);
  });

  it("saves an exam course under the id its Library lookup resolved, whatever the key's case", async () => {
    const [user, blueprint, organization] = await Promise.all([
      userFixture(),
      examBlueprintFixture({
        structure: {
          formats: ["multipleChoice"],
          subjects: SUBJECTS.map((name) => ({ name, topics: [`Apply ${name}`], weight: 0.25 })),
        },
      }),
      aiOrganizationFixture(),
    ]);

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    const word = `zq${randomUUID().replaceAll("-", "")}`;
    const title = `Matemática ${word}`;

    const existing = await courseFixture({
      normalizedTitle: normalizeString(title),
      organizationId: organization.id,
      title,
    });

    // The model wrote the course key in capitals; normalization lowercases it in the graph.
    const { data: frame, ...frameResult } = taskResult({
      courses: [{ key: "Math", levels: ["beginner" as const], title: `Mathematics ${word}` }],
      phases: [{ milestone: "Solve problems", title: "Foundations" }],
      sections: SUBJECTS.map((area, index) => ({
        area,
        course: "Math",
        estimatedLessons: 4,
        phases: [1],
        skills: 1,
        subject: `S${index + 1}`,
      })),
    });

    vi.mocked(generateSkillGraphFrame).mockResolvedValue({ ...frameResult, output: frame });

    vi.mocked(generateSkillGraphSection).mockImplementation(async ({ part }) => {
      const section = part.sections[0]!;
      const { data, ...result } = taskResult({ skills: [skill(section.area, "Math")] });
      return { ...result, output: data };
    });

    vi.mocked(generateSearchTerms).mockImplementation(async () =>
      taskResult({ subjects: [{ terms: [word] }] }),
    );

    // The identity call is a model call: the lookup's call matched the Library course, a second
    // call for the same course may not.
    vi.mocked(decideLibraryIdentity)
      .mockResolvedValueOnce({
        match: { id: existing.id, model: "test", probability: 0.99 },
        verdicts: [],
      })
      .mockResolvedValue({ match: null, verdicts: [] });

    const run = await start(skillGraphTestWorkflow, [goal.id, false, true]);
    const built = await run.returnValue;

    const created = await prisma.course.findMany({
      select: { id: true },
      where: { title: `Mathematics ${word}` },
    });

    expect({
      courseIdsByKey: built.courseIdsByKey,
      created,
      graphKeys: built.graph.courses.map((course) => course.key),
      searchCalls: vi.mocked(generateSearchTerms).mock.calls.length,
    }).toStrictEqual({
      courseIdsByKey: { math: existing.id },
      created: [],
      graphKeys: ["math"],
      searchCalls: 1,
    });
  });
});
