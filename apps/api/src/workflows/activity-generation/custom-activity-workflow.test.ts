import { randomUUID } from "node:crypto";
import { generateActivityBackground } from "@zoonk/ai/tasks/activities/core/background";
import { generateActivityCustom } from "@zoonk/ai/tasks/activities/custom";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { activityGenerationWorkflow } from "./activity-generation-workflow";

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

vi.mock("@zoonk/ai/tasks/activities/core/background", () => ({
  generateActivityBackground: vi.fn().mockResolvedValue({
    data: { steps: [{ text: "Background step 1 text", title: "Background Step 1" }] },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/explanation", () => ({
  generateActivityExplanation: vi.fn().mockResolvedValue({
    data: { steps: [{ text: "Explanation step 1 text", title: "Explanation Step 1" }] },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/mechanics", () => ({
  generateActivityMechanics: vi.fn().mockResolvedValue({ data: { steps: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/examples", () => ({
  generateActivityExamples: vi.fn().mockResolvedValue({ data: { steps: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/story", () => ({
  generateActivityStory: vi.fn().mockResolvedValue({ data: { steps: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/challenge", () => ({
  generateActivityChallenge: vi.fn().mockResolvedValue({ data: { steps: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/review", () => ({
  generateActivityReview: vi.fn().mockResolvedValue({ data: { questions: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/explanation-quiz", () => ({
  generateActivityExplanationQuiz: vi.fn().mockResolvedValue({ data: { questions: [] } }),
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
  generateStepVisuals: vi.fn().mockResolvedValue({
    data: {
      visuals: [
        { kind: "image", prompt: "A visual prompt for step 1", stepIndex: 0 },
        { code: "const x = 1;", kind: "code", language: "typescript", stepIndex: 1 },
      ],
    },
  }),
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

vi.mock("@zoonk/core/cache/revalidate", () => ({
  revalidateMainApp: vi.fn().mockResolvedValue(null),
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

  test("doesn't call generateActivityCustom if lesson has no custom activities", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId,
      title: `No Custom Lesson ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "background",
      lessonId: testLesson.id,
      organizationId,
      title: `Background ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateActivityCustom).not.toHaveBeenCalled();
  });

  test("generates content for a single custom activity with correct params", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId,
      title: `Single Custom Lesson ${randomUUID()}`,
    });

    await activityFixture({
      description: "Learn the fundamentals of testing",
      generationStatus: "pending",
      kind: "custom",
      lessonId: testLesson.id,
      organizationId,
      title: `Practice Testing ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateActivityCustom).toHaveBeenCalledOnce();
    expect(generateActivityCustom).toHaveBeenCalledWith(
      expect.objectContaining({
        activityDescription: "Learn the fundamentals of testing",
        activityTitle: expect.stringContaining("Practice Testing"),
      }),
    );
    // Core workflow should not be invoked
    expect(generateActivityBackground).not.toHaveBeenCalled();
  });

  test("generates content for multiple custom activities in parallel", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId,
      title: `Multi Custom Lesson ${randomUUID()}`,
    });

    await activityFixture({
      description: "First custom description",
      generationStatus: "pending",
      kind: "custom",
      lessonId: testLesson.id,
      organizationId,
      title: `Custom One ${randomUUID()}`,
    });

    await activityFixture({
      description: "Second custom description",
      generationStatus: "pending",
      kind: "custom",
      lessonId: testLesson.id,
      organizationId,
      title: `Custom Two ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateActivityCustom).toHaveBeenCalledTimes(2);
    expect(generateActivityCustom).toHaveBeenCalledWith(
      expect.objectContaining({ activityDescription: "First custom description" }),
    );
    expect(generateActivityCustom).toHaveBeenCalledWith(
      expect.objectContaining({ activityDescription: "Second custom description" }),
    );
  });

  test("sets custom status to 'failed' when generateActivityCustom throws", async () => {
    vi.mocked(generateActivityCustom).mockRejectedValueOnce(new Error("Custom generation failed"));

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId,
      title: `Custom Error Lesson ${randomUUID()}`,
    });

    const customActivity = await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      lessonId: testLesson.id,
      organizationId,
      title: `Error Custom ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: customActivity.id },
    });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("creates custom steps in database with static kind and correct content", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId,
      title: `Custom Steps DB Lesson ${randomUUID()}`,
    });

    const customActivity = await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      lessonId: testLesson.id,
      organizationId,
      title: `Custom ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const customSteps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: customActivity.id },
    });

    expect(customSteps).toHaveLength(2);

    for (const step of customSteps) {
      expect(step.isPublished).toBeTruthy();
    }

    expect(customSteps[0]?.kind).toBe("static");
    expect(customSteps[0]?.content).toEqual({
      text: "Custom step 1 text",
      title: "Custom Step 1",
      variant: "text",
    });
    expect(customSteps[1]?.content).toEqual({
      text: "Custom step 2 text",
      title: "Custom Step 2",
      variant: "text",
    });
  });

  test("creates steps with visuals for custom activities", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId,
      title: `Custom Visuals Lesson ${randomUUID()}`,
    });

    const customActivity = await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      lessonId: testLesson.id,
      organizationId,
      title: `Custom ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const customSteps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: customActivity.id },
    });

    expect(customSteps[0]?.visualKind).toBe("image");
    expect(customSteps[1]?.visualKind).toBe("code");
  });

  test("generates images for custom activity steps", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId,
      title: `Custom Images Lesson ${randomUUID()}`,
    });

    const customActivity = await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      lessonId: testLesson.id,
      organizationId,
      title: `Custom ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const customSteps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: customActivity.id },
    });

    const imageStep = customSteps[0];
    expect(imageStep?.visualKind).toBe("image");
    expect(imageStep?.visualContent).toEqual(
      expect.objectContaining({ url: "https://example.com/image.webp" }),
    );
  });

  test("sets custom status to 'completed' after saving", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId,
      title: `Custom Complete Lesson ${randomUUID()}`,
    });

    const customActivity = await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      lessonId: testLesson.id,
      organizationId,
      title: `Custom ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: customActivity.id },
    });
    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
  });

  test("skips custom generation if already completed", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId,
      title: `Custom Resume Lesson ${randomUUID()}`,
    });

    const customActivity = await activityFixture({
      generationStatus: "completed",
      kind: "custom",
      lessonId: testLesson.id,
      organizationId,
      title: `Completed Custom ${randomUUID()}`,
    });

    await stepFixture({
      activityId: customActivity.id,
      content: { text: "Existing custom text", title: "Existing Custom" },
      position: 0,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateActivityCustom).not.toHaveBeenCalled();
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

    expect(dbFailing?.generationStatus).toBe("failed");
    expect(dbSucceeding?.generationStatus).toBe("completed");
  });
});
