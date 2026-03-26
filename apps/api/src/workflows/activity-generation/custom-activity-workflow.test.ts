import { randomUUID } from "node:crypto";
import { generateActivityCustom } from "@zoonk/ai/tasks/activities/custom";
import { type generateStepVisuals } from "@zoonk/ai/tasks/steps/visual";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { activityGenerationWorkflow } from "./activity-generation-workflow";

function createStepVisualsResult(
  steps: { title: string; text: string }[],
): Awaited<ReturnType<typeof generateStepVisuals>> {
  return {
    data: {
      visuals: steps.map((step, stepIndex) =>
        stepIndex === 0
          ? { kind: "image", prompt: `A visual prompt for ${step.title}`, stepIndex }
          : {
              annotations: null,
              code: "const x = 1;",
              kind: "code",
              language: "typescript",
              stepIndex,
            },
      ),
    },
    systemPrompt: "test",
    usage: {} as Awaited<ReturnType<typeof generateStepVisuals>>["usage"],
    userPrompt: "test",
  };
}

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: vi.fn().mockResolvedValue(null),
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

vi.mock("@zoonk/ai/tasks/activities/core/explanation", () => ({
  generateActivityExplanation: vi.fn().mockResolvedValue({
    data: { steps: [{ text: "Explanation step 1 text", title: "Explanation Step 1" }] },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/practice", () => ({
  generateActivityPractice: vi.fn().mockResolvedValue({ data: { steps: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/challenge", () => ({
  generateActivityChallenge: vi.fn().mockResolvedValue({ data: { steps: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/quiz", () => ({
  generateActivityQuiz: vi.fn().mockResolvedValue({ data: { questions: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/custom", () => ({
  generateActivityCustom: vi.fn().mockResolvedValue({
    data: {
      steps: [
        { text: "Custom step 1 text", title: "Custom Step 1" },
        { text: "Custom step 2 text", title: "Custom Step 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/steps/visual", () => ({
  generateStepVisuals: vi
    .fn()
    .mockImplementation(({ steps }: { steps: { title: string; text: string }[] }) =>
      Promise.resolve(createStepVisualsResult(steps)),
    ),
}));

vi.mock("@zoonk/core/steps/visual-image", () => ({
  generateVisualStepImage: vi.fn().mockResolvedValue({
    data: "https://example.com/image.webp",
    error: null,
  }),
}));

vi.mock("@zoonk/core/steps/image", () => ({
  generateStepImage: vi.fn().mockResolvedValue({
    data: "https://example.com/quiz-image.webp",
    error: null,
  }),
}));

describe("custom activity workflow", () => {
  let organizationId: number;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Test Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("one custom activity fails while others still complete", async () => {
    vi.mocked(generateActivityCustom).mockImplementation(({ activityTitle }) => {
      if (activityTitle.startsWith("Failing Custom")) {
        return Promise.reject(new Error("First custom failed"));
      }

      return Promise.resolve({
        data: {
          steps: [{ text: "Second succeeds", title: "Second Custom" }],
        },
        systemPrompt: "test",
        // oxlint-disable-next-line no-unsafe-type-assertion -- test mock
        usage: {} as Awaited<ReturnType<typeof generateActivityCustom>>["usage"],
        userPrompt: "test",
      });
    });

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId,
      title: `Custom Isolation Lesson ${randomUUID()}`,
    });

    const [failingCustom, succeedingCustom] = await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "custom",
        lessonId: testLesson.id,
        organizationId,
        position: 0,
        title: `Failing Custom ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "custom",
        lessonId: testLesson.id,
        organizationId,
        position: 1,
        title: `Succeeding Custom ${randomUUID()}`,
      }),
    ]);

    await activityGenerationWorkflow(testLesson.id);

    const [dbFailing, dbSucceeding] = await Promise.all([
      prisma.activity.findUnique({ where: { id: failingCustom.id } }),
      prisma.activity.findUnique({ where: { id: succeedingCustom.id } }),
    ]);

    // The failing activity stays "pending" because generateCustomContentStep catches
    // the rejection via Promise.allSettled and drops it — no code marks it as "failed".
    expect(dbFailing?.generationStatus).toBe("pending");
    expect(dbSucceeding?.generationStatus).toBe("completed");
  });
});
