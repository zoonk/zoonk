import { randomUUID } from "node:crypto";
import { generateActivityBackground } from "@zoonk/ai/tasks/activities/core/background";
import { generateActivityCustom } from "@zoonk/ai/tasks/activities/custom";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
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
    data: {
      steps: [
        { text: "Background step 1 text", title: "Background Step 1" },
        { text: "Background step 2 text", title: "Background Step 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/explanation", () => ({
  generateActivityExplanation: vi.fn().mockResolvedValue({
    data: {
      steps: [
        { text: "Explanation step 1 text", title: "Explanation Step 1" },
        { text: "Explanation step 2 text", title: "Explanation Step 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/mechanics", () => ({
  generateActivityMechanics: vi.fn().mockResolvedValue({
    data: {
      steps: [
        { text: "Mechanics step 1 text", title: "Mechanics Step 1" },
        { text: "Mechanics step 2 text", title: "Mechanics Step 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/examples", () => ({
  generateActivityExamples: vi.fn().mockResolvedValue({
    data: {
      steps: [
        { text: "Examples step 1 text", title: "Examples Step 1" },
        { text: "Examples step 2 text", title: "Examples Step 2" },
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

vi.mock("@zoonk/ai/tasks/activities/core/story", () => ({
  generateActivityStory: vi.fn().mockResolvedValue({
    data: {
      steps: [
        {
          context: "Your colleague turns to you during a meeting...",
          options: [
            { feedback: "Great choice!", isCorrect: true, text: "Option A" },
            { feedback: "Not quite.", isCorrect: false, text: "Option B" },
            { feedback: "Try again.", isCorrect: false, text: "Option C" },
            { feedback: "Nope.", isCorrect: false, text: "Option D" },
          ],
          question: "What should you do?",
        },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/challenge", () => ({
  generateActivityChallenge: vi.fn().mockResolvedValue({
    data: {
      intro: "Welcome to the challenge scenario...",
      reflection: "Every decision involves trade-offs...",
      steps: [
        {
          context: "Your team lead asks you to choose...",
          options: [
            {
              consequence: "Great outcome",
              effects: [{ dimension: "Quality", impact: "positive" }],
              text: "Option A",
            },
            {
              consequence: "Mixed outcome",
              effects: [{ dimension: "Speed", impact: "positive" }],
              text: "Option B",
            },
            {
              consequence: "Poor outcome",
              effects: [{ dimension: "Quality", impact: "negative" }],
              text: "Option C",
            },
          ],
          question: "What approach do you take?",
        },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/review", () => ({
  generateActivityReview: vi.fn().mockResolvedValue({
    data: {
      questions: [
        {
          context: "Review context about the lesson content...",
          options: [
            { feedback: "Correct!", isCorrect: true, text: "Option A" },
            { feedback: "Not quite.", isCorrect: false, text: "Option B" },
            { feedback: "Try again.", isCorrect: false, text: "Option C" },
            { feedback: "Nope.", isCorrect: false, text: "Option D" },
          ],
          question: "What is the correct answer?",
        },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/explanation-quiz", () => ({
  generateActivityExplanationQuiz: vi.fn().mockResolvedValue({
    data: {
      questions: [
        {
          context: "Testing context",
          format: "multipleChoice",
          options: [
            { feedback: "Correct!", isCorrect: true, text: "Option A" },
            { feedback: "Incorrect", isCorrect: false, text: "Option B" },
          ],
          question: "What is the correct answer?",
        },
        {
          format: "selectImage",
          options: [
            { feedback: "This is correct", isCorrect: true, prompt: "A cat sitting" },
            { feedback: "This is incorrect", isCorrect: false, prompt: "A dog running" },
          ],
          question: "Which image shows a cat?",
        },
      ],
    },
  }),
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

vi.mock("@zoonk/core/steps/image", () => ({
  generateStepImage: vi.fn().mockResolvedValue({
    data: "https://example.com/quiz-image.webp",
    error: null,
  }),
}));

vi.mock("@zoonk/core/cache/revalidate", () => ({
  revalidateMainApp: vi.fn().mockResolvedValue(null),
}));

describe(activityGenerationWorkflow, () => {
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

  describe("lesson validation", () => {
    test("throws error when lesson has no activities", async () => {
      const emptyLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Empty Lesson ${randomUUID()}`,
      });

      await expect(activityGenerationWorkflow(emptyLesson.id)).rejects.toThrow(
        "No activities found for lesson",
      );

      expect(generateActivityBackground).not.toHaveBeenCalled();
    });
  });

  describe("routing", () => {
    test("routes core lessons to core workflow", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        kind: "core",
        organizationId,
        title: `Core Routing Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Background ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).toHaveBeenCalledOnce();
      expect(generateActivityCustom).not.toHaveBeenCalled();
    });

    test("routes custom lessons to custom workflow", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        kind: "custom",
        organizationId,
        title: `Custom Routing Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "custom",
        lessonId: testLesson.id,
        organizationId,
        title: `Custom ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityCustom).toHaveBeenCalledOnce();
      expect(generateActivityBackground).not.toHaveBeenCalled();
    });

    test("routes language lessons to language workflow", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        kind: "language",
        organizationId,
        title: `Language Routing Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Background ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).not.toHaveBeenCalled();
      expect(generateActivityCustom).not.toHaveBeenCalled();
    });
  });

  describe("workflow failure handling", () => {
    test("marks running activities as failed and re-throws on workflow crash", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Failure Handling Lesson ${randomUUID()}`,
      });

      const runningActivity = await activityFixture({
        generationRunId: "test-run-id",
        generationStatus: "running",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Running Activity ${randomUUID()}`,
      });

      const completedActivity = await activityFixture({
        generationRunId: "test-run-id",
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Completed Activity ${randomUUID()}`,
      });

      const pendingActivity = await activityFixture({
        generationStatus: "pending",
        kind: "mechanics",
        lessonId: testLesson.id,
        organizationId,
        title: `Pending Activity ${randomUUID()}`,
      });

      const originalFindMany = prisma.activity.findMany.bind(prisma.activity);
      let callCount = 0;

      prisma.activity.findMany = ((...args: Parameters<typeof originalFindMany>) => {
        callCount += 1;

        if (callCount === 1) {
          return Promise.reject(new Error("DB connection lost"));
        }

        return originalFindMany(...args);
      }) as typeof originalFindMany;

      await expect(activityGenerationWorkflow(testLesson.id)).rejects.toThrow("DB connection lost");

      prisma.activity.findMany = originalFindMany;

      const [running, completed, pending] = await Promise.all([
        prisma.activity.findUnique({ where: { id: runningActivity.id } }),
        prisma.activity.findUnique({ where: { id: completedActivity.id } }),
        prisma.activity.findUnique({ where: { id: pendingActivity.id } }),
      ]);

      expect(running?.generationStatus).toBe("failed");
      expect(completed?.generationStatus).toBe("completed");
      expect(pending?.generationStatus).toBe("pending");
    });

    test("only marks activities matching the current workflowRunId", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Wrong RunId Lesson ${randomUUID()}`,
      });

      const otherRunActivity = await activityFixture({
        generationRunId: "different-run-id",
        generationStatus: "running",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Other Run Activity ${randomUUID()}`,
      });

      const originalFindMany = prisma.activity.findMany.bind(prisma.activity);
      let callCount = 0;

      prisma.activity.findMany = ((...args: Parameters<typeof originalFindMany>) => {
        callCount += 1;

        if (callCount === 1) {
          return Promise.reject(new Error("DB connection lost"));
        }

        return originalFindMany(...args);
      }) as typeof originalFindMany;

      await expect(activityGenerationWorkflow(testLesson.id)).rejects.toThrow("DB connection lost");

      prisma.activity.findMany = originalFindMany;

      const activity = await prisma.activity.findUnique({
        where: { id: otherRunActivity.id },
      });

      expect(activity?.generationStatus).toBe("running");
    });
  });
});
