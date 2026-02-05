import { randomUUID } from "node:crypto";
import { generateActivityBackground } from "@zoonk/ai/tasks/activities/core/background";
import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { generateActivityExplanationQuiz } from "@zoonk/ai/tasks/activities/core/explanation-quiz";
import { generateActivityMechanics } from "@zoonk/ai/tasks/activities/core/mechanics";
import { generateStepVisuals } from "@zoonk/ai/tasks/steps/visual";
import { generateStepImage } from "@zoonk/core/steps/image";
import { generateVisualStepImage } from "@zoonk/core/steps/visual-image";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { activityGenerationWorkflow } from "./activity-generation-workflow";

// Store for hook data to simulate hook communication between workflows
const hookStore = new Map<string, { steps: { text: string; title: string }[] }>();

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  defineHook: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockImplementation(
      ({ token }: { token: string }) =>
        new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            const data = hookStore.get(token);
            if (data) {
              clearInterval(checkInterval);
              resolve(data);
            }
          }, 10);
          // Timeout after 5 seconds to prevent hanging tests
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve({ steps: [] });
          }, 5000);
        }),
    ),
    resume: vi.fn().mockImplementation((token: string, data: unknown) => {
      hookStore.set(token, data as { steps: { text: string; title: string }[] });
      return Promise.resolve();
    }),
  })),
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: vi.fn().mockResolvedValue(null),
    }),
  }),
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
    hookStore.clear();
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
      expect(generateActivityExplanation).not.toHaveBeenCalled();
    });
  });

  describe("background generation", () => {
    test("doesn't call generateActivityBackground if lesson has no background activity", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `No BG Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Explanation Only ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).not.toHaveBeenCalled();
    });

    test("doesn't call generateActivityBackground if background status is 'running'", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Running Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "running",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Running Background ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).not.toHaveBeenCalled();
    });

    test("doesn't call generateActivityBackground if background status is 'completed'", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Completed BG Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Completed Background ${randomUUID()}`,
      });

      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "Existing background text", title: "Existing Background" },
        position: 0,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).not.toHaveBeenCalled();
    });

    test("sets background status to 'running' when generation starts", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Running Status Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Pending Background ${randomUUID()}`,
      });

      let capturedStatus: string | null = null;

      vi.mocked(generateActivityBackground).mockImplementationOnce(async () => {
        const dbActivity = await prisma.activity.findUnique({
          where: { id: activity.id },
        });
        capturedStatus = dbActivity?.generationStatus ?? null;

        return {
          data: {
            steps: [{ text: "Step text", title: "Step Title" }],
          },
          systemPrompt: "test",
          usage: {} as Awaited<ReturnType<typeof generateActivityBackground>>["usage"],
          userPrompt: "test",
        };
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(capturedStatus).toBe("running");
    });

    test("sets background status to 'failed' when generateActivityBackground throws", async () => {
      vi.mocked(generateActivityBackground).mockRejectedValueOnce(
        new Error("AI generation failed"),
      );

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Error Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Error Activity ${randomUUID()}`,
      });

      // With Promise.allSettled, launcher doesn't throw - just marks activity as failed
      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });
      expect(dbActivity?.generationStatus).toBe("failed");
    });

    test("sets background status to 'failed' when generateStepVisuals throws", async () => {
      vi.mocked(generateStepVisuals).mockRejectedValueOnce(new Error("Visual generation failed"));

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Visual Error Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Visual Fail ${randomUUID()}`,
      });

      // With Promise.allSettled, launcher doesn't throw - just marks activity as failed
      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });
      expect(dbActivity?.generationStatus).toBe("failed");
    });

    test("creates steps in database with correct content", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Steps Content Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Background ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const backgroundSteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: backgroundActivity.id },
      });

      expect(backgroundSteps).toHaveLength(2);
      expect(backgroundSteps[0]?.content).toEqual({
        text: "Background step 1 text",
        title: "Background Step 1",
      });
      expect(backgroundSteps[1]?.content).toEqual({
        text: "Background step 2 text",
        title: "Background Step 2",
      });
    });

    test("creates steps with image visuals including generated URL", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Image Visual Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Image Visual ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const steps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: activity.id },
      });

      expect(steps[0]?.visualKind).toBe("image");
      expect(steps[0]?.visualContent).toEqual({
        prompt: "A visual prompt for step 1",
        url: "https://example.com/image.webp",
      });
    });

    test("creates steps with non-image visuals (code, diagram, quote)", async () => {
      vi.mocked(generateStepVisuals).mockResolvedValueOnce({
        data: {
          visuals: [
            {
              edges: [{ source: "1", target: "2" }],
              kind: "diagram",
              nodes: [
                { id: "1", label: "Node 1" },
                { id: "2", label: "Node 2" },
              ],
              stepIndex: 0,
            },
            { kind: "quote", quote: "A quote", source: "Author", stepIndex: 1 },
          ],
        },
      } as Awaited<ReturnType<typeof generateStepVisuals>>);

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Visual Mapping Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Visual Mapping ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const steps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: activity.id },
      });

      expect(steps[0]?.visualKind).toBe("diagram");
      expect(steps[0]?.visualContent).toEqual({
        edges: [{ source: "1", target: "2" }],
        nodes: [
          { id: "1", label: "Node 1" },
          { id: "2", label: "Node 2" },
        ],
      });

      expect(steps[1]?.visualKind).toBe("quote");
      expect(steps[1]?.visualContent).toEqual({
        quote: "A quote",
        source: "Author",
      });
    });

    test("creates steps without URL when image generation fails", async () => {
      vi.mocked(generateVisualStepImage).mockResolvedValueOnce({
        data: null,
        error: new Error("Image generation failed"),
      });

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Image Fail Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Image Fail ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });
      expect(dbActivity?.generationStatus).toBe("completed");

      const steps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: activity.id },
      });

      expect(steps[0]?.visualKind).toBe("image");
      expect(steps[0]?.visualContent).toEqual({
        prompt: "A visual prompt for step 1",
      });
    });

    test("continues processing other images when one throws", async () => {
      vi.mocked(generateStepVisuals).mockResolvedValueOnce({
        data: {
          visuals: [
            { kind: "image", prompt: "First image prompt", stepIndex: 0 },
            { kind: "image", prompt: "Second image prompt", stepIndex: 1 },
          ],
        },
      } as Awaited<ReturnType<typeof generateStepVisuals>>);

      vi.mocked(generateVisualStepImage)
        .mockRejectedValueOnce(new Error("First image failed"))
        .mockResolvedValueOnce({
          data: "https://example.com/second-image.webp",
          error: null,
        });

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Partial Image Fail Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Partial Image Fail ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });
      expect(dbActivity?.generationStatus).toBe("completed");

      const steps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: activity.id },
      });

      // First step should have no URL (image generation threw)
      expect(steps[0]?.visualKind).toBe("image");
      expect(steps[0]?.visualContent).toEqual({
        prompt: "First image prompt",
      });

      // Second step should have URL (image generation succeeded)
      expect(steps[1]?.visualKind).toBe("image");
      expect(steps[1]?.visualContent).toEqual({
        prompt: "Second image prompt",
        url: "https://example.com/second-image.webp",
      });
    });

    test("sets background status to 'completed' after saving steps", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Status Completed Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Status Completed ${randomUUID()}`,
      });

      const initialActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });
      expect(initialActivity?.generationStatus).toBe("pending");

      await activityGenerationWorkflow(testLesson.id);

      const finalActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });
      expect(finalActivity?.generationStatus).toBe("completed");
      expect(finalActivity?.generationRunId).toBe("test-run-id");
    });
  });

  describe("explanation generation", () => {
    test("doesn't call generateActivityExplanation if lesson has no explanation activity", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `BG Only Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Background Only ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).toHaveBeenCalledOnce();
      expect(generateActivityExplanation).not.toHaveBeenCalled();
    });

    test("doesn't call generateActivityExplanation if explanation status is 'running'", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Exp Running Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "running",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Running Explanation ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).toHaveBeenCalledOnce();
      expect(generateActivityExplanation).not.toHaveBeenCalled();
    });

    test("doesn't call generateActivityExplanation if explanation status is 'completed'", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Exp Completed Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Background ${randomUUID()}`,
      });

      const explanationActivity = await activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Completed Explanation ${randomUUID()}`,
      });

      await stepFixture({
        activityId: explanationActivity.id,
        content: { text: "Existing explanation text", title: "Existing Explanation" },
        position: 0,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).toHaveBeenCalledOnce();
      expect(generateActivityExplanation).not.toHaveBeenCalled();
    });

    test("doesn't call generateActivityExplanation if background steps are empty", async () => {
      vi.mocked(generateActivityBackground).mockResolvedValueOnce({
        data: { steps: [] },
        systemPrompt: "test",
        usage: {} as Awaited<ReturnType<typeof generateActivityBackground>>["usage"],
        userPrompt: "test",
      });

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Empty BG Steps Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).toHaveBeenCalledOnce();
      expect(generateActivityExplanation).not.toHaveBeenCalled();
    });

    test("passes background steps to generateActivityExplanation", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `BG Steps Pass Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanation).toHaveBeenCalledWith(
        expect.objectContaining({
          backgroundSteps: [
            { text: "Background step 1 text", title: "Background Step 1" },
            { text: "Background step 2 text", title: "Background Step 2" },
          ],
        }),
      );
    });

    test("sets explanation status to 'running' when generation starts", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Exp Running Status Lesson ${randomUUID()}`,
      });

      const [, explanationActivity] = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Pending Explanation ${randomUUID()}`,
        }),
      ]);

      let capturedStatus: string | null = null;

      vi.mocked(generateActivityExplanation).mockImplementationOnce(async () => {
        const dbActivity = await prisma.activity.findUnique({
          where: { id: explanationActivity.id },
        });
        capturedStatus = dbActivity?.generationStatus ?? null;

        return {
          data: {
            steps: [{ text: "Step text", title: "Step Title" }],
          },
          systemPrompt: "test",
          usage: {} as Awaited<ReturnType<typeof generateActivityExplanation>>["usage"],
          userPrompt: "test",
        };
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(capturedStatus).toBe("running");
    });

    test("sets explanation status to 'failed' when generateActivityExplanation throws", async () => {
      vi.mocked(generateActivityExplanation).mockRejectedValueOnce(
        new Error("Explanation generation failed"),
      );

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Exp Error Lesson ${randomUUID()}`,
      });

      const [, explanationActivity] = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Error Explanation ${randomUUID()}`,
        }),
      ]);

      // With Promise.allSettled, launcher doesn't throw - just marks activity as failed
      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: explanationActivity.id },
      });
      expect(dbActivity?.generationStatus).toBe("failed");
    });

    test("creates explanation steps in database", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Exp Steps Lesson ${randomUUID()}`,
      });

      const [, explanationActivity] = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      const explanationSteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: explanationActivity.id },
      });

      expect(explanationSteps).toHaveLength(2);
      expect(explanationSteps[0]?.content).toEqual({
        text: "Explanation step 1 text",
        title: "Explanation Step 1",
      });
      expect(explanationSteps[1]?.content).toEqual({
        text: "Explanation step 2 text",
        title: "Explanation Step 2",
      });
    });

    test("sets explanation status to 'completed' after saving steps", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Exp Completed Status Lesson ${randomUUID()}`,
      });

      const [, explanationActivity] = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
      ]);

      const initialActivity = await prisma.activity.findUnique({
        where: { id: explanationActivity.id },
      });
      expect(initialActivity?.generationStatus).toBe("pending");

      await activityGenerationWorkflow(testLesson.id);

      const finalActivity = await prisma.activity.findUnique({
        where: { id: explanationActivity.id },
      });
      expect(finalActivity?.generationStatus).toBe("completed");
      expect(finalActivity?.generationRunId).toBe("test-run-id");
    });
  });

  describe("quiz generation", () => {
    test("doesn't call generateActivityExplanationQuiz if lesson has no quiz activity", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `No Quiz Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanationQuiz).not.toHaveBeenCalled();
    });

    test("doesn't call generateActivityExplanationQuiz if quiz status is 'running'", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Quiz Running Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "running",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          title: `Running Quiz ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanationQuiz).not.toHaveBeenCalled();
    });

    test("doesn't call generateActivityExplanationQuiz if quiz status is 'completed'", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Quiz Completed Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
      ]);

      const quizActivity = await activityFixture({
        generationStatus: "completed",
        kind: "quiz",
        lessonId: testLesson.id,
        organizationId,
        title: `Completed Quiz ${randomUUID()}`,
      });

      await stepFixture({
        activityId: quizActivity.id,
        kind: "multipleChoice",
        position: 0,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanationQuiz).not.toHaveBeenCalled();
    });

    test("doesn't call generateActivityExplanationQuiz if explanation steps are empty", async () => {
      vi.mocked(generateActivityExplanation).mockResolvedValueOnce({
        data: { steps: [] },
        systemPrompt: "test",
        usage: {} as Awaited<ReturnType<typeof generateActivityExplanation>>["usage"],
        userPrompt: "test",
      });

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Empty Exp Steps Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          title: `Quiz ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanationQuiz).not.toHaveBeenCalled();
    });

    test("passes explanation steps to generateActivityExplanationQuiz", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Exp Steps Pass Quiz Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          title: `Quiz ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanationQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          explanationSteps: [
            { text: "Explanation step 1 text", title: "Explanation Step 1" },
            { text: "Explanation step 2 text", title: "Explanation Step 2" },
          ],
        }),
      );
    });

    test("sets quiz status to 'running' when generation starts", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Quiz Running Status Lesson ${randomUUID()}`,
      });

      const activities = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          title: `Pending Quiz ${randomUUID()}`,
        }),
      ]);

      const quizActivity = activities[2];

      let capturedStatus: string | null = null;

      vi.mocked(generateActivityExplanationQuiz).mockImplementationOnce(async () => {
        const dbActivity = await prisma.activity.findUnique({
          where: { id: quizActivity?.id },
        });
        capturedStatus = dbActivity?.generationStatus ?? null;

        return {
          data: {
            questions: [
              {
                context: "Test",
                format: "multipleChoice" as const,
                options: [{ feedback: "Test", isCorrect: true, text: "Option" }],
                question: "Test?",
              },
            ],
          },
          systemPrompt: "test",
          usage: {} as Awaited<ReturnType<typeof generateActivityExplanationQuiz>>["usage"],
          userPrompt: "test",
        };
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(capturedStatus).toBe("running");
    });

    test("sets quiz status to 'failed' when generateActivityExplanationQuiz throws", async () => {
      vi.mocked(generateActivityExplanationQuiz).mockRejectedValueOnce(
        new Error("Quiz generation failed"),
      );

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Quiz Error Lesson ${randomUUID()}`,
      });

      const activities = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          title: `Error Quiz ${randomUUID()}`,
        }),
      ]);

      const quizActivity = activities[2];

      // With Promise.allSettled, launcher doesn't throw - just marks activity as failed
      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: quizActivity?.id },
      });
      expect(dbActivity?.generationStatus).toBe("failed");
    });

    test("creates quiz steps in database with correct kind", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Quiz Steps Lesson ${randomUUID()}`,
      });

      const activities = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          title: `Quiz ${randomUUID()}`,
        }),
      ]);

      const quizActivity = activities[2];

      await activityGenerationWorkflow(testLesson.id);

      const quizSteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: quizActivity?.id },
      });

      expect(quizSteps).toHaveLength(2);
      expect(quizSteps[0]?.kind).toBe("multipleChoice");
      expect(quizSteps[1]?.kind).toBe("selectImage");
    });

    test("creates quiz steps with correct content structure", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Quiz Content Lesson ${randomUUID()}`,
      });

      const activities = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          title: `Quiz ${randomUUID()}`,
        }),
      ]);

      const quizActivity = activities[2];

      await activityGenerationWorkflow(testLesson.id);

      const quizSteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: quizActivity?.id },
      });

      // Multiple choice step content (format excluded)
      expect(quizSteps[0]?.content).toEqual({
        context: "Testing context",
        options: [
          { feedback: "Correct!", isCorrect: true, text: "Option A" },
          { feedback: "Incorrect", isCorrect: false, text: "Option B" },
        ],
        question: "What is the correct answer?",
      });

      // SelectImage step content includes URLs from image generation
      expect(quizSteps[1]?.content).toEqual({
        options: [
          {
            feedback: "This is correct",
            isCorrect: true,
            prompt: "A cat sitting",
            url: "https://example.com/quiz-image.webp",
          },
          {
            feedback: "This is incorrect",
            isCorrect: false,
            prompt: "A dog running",
            url: "https://example.com/quiz-image.webp",
          },
        ],
        question: "Which image shows a cat?",
      });
    });

    test("creates selectImage steps without URL when image generation fails", async () => {
      vi.mocked(generateStepImage).mockResolvedValue({
        data: null,
        error: new Error("Image generation failed"),
      });

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Quiz Image Fail Lesson ${randomUUID()}`,
      });

      const activities = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          title: `Quiz ${randomUUID()}`,
        }),
      ]);

      const quizActivity = activities[2];

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: quizActivity?.id },
      });
      expect(dbActivity?.generationStatus).toBe("completed");

      const quizSteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: quizActivity?.id },
      });

      // SelectImage step content should not have URL
      expect(quizSteps[1]?.content).toEqual({
        options: [
          { feedback: "This is correct", isCorrect: true, prompt: "A cat sitting" },
          { feedback: "This is incorrect", isCorrect: false, prompt: "A dog running" },
        ],
        question: "Which image shows a cat?",
      });
    });

    test("continues processing other images when one throws", async () => {
      vi.mocked(generateStepImage)
        .mockRejectedValueOnce(new Error("First image failed"))
        .mockResolvedValueOnce({
          data: "https://example.com/second-quiz-image.webp",
          error: null,
        });

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Quiz Partial Image Fail Lesson ${randomUUID()}`,
      });

      const activities = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          title: `Quiz ${randomUUID()}`,
        }),
      ]);

      const quizActivity = activities[2];

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: quizActivity?.id },
      });
      expect(dbActivity?.generationStatus).toBe("completed");

      const quizSteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: quizActivity?.id },
      });

      // First option should have no URL (image generation threw)
      // Second option should have URL (image generation succeeded)
      expect(quizSteps[1]?.content).toEqual({
        options: [
          { feedback: "This is correct", isCorrect: true, prompt: "A cat sitting" },
          {
            feedback: "This is incorrect",
            isCorrect: false,
            prompt: "A dog running",
            url: "https://example.com/second-quiz-image.webp",
          },
        ],
        question: "Which image shows a cat?",
      });
    });

    test("sets quiz status to 'completed' after saving steps", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Quiz Completed Status Lesson ${randomUUID()}`,
      });

      const activities = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          title: `Quiz ${randomUUID()}`,
        }),
      ]);

      const quizActivity = activities[2];

      const initialActivity = await prisma.activity.findUnique({
        where: { id: quizActivity?.id },
      });
      expect(initialActivity?.generationStatus).toBe("pending");

      await activityGenerationWorkflow(testLesson.id);

      const finalActivity = await prisma.activity.findUnique({
        where: { id: quizActivity?.id },
      });
      expect(finalActivity?.generationStatus).toBe("completed");
      expect(finalActivity?.generationRunId).toBe("test-run-id");
    });
  });

  describe("mechanics generation", () => {
    test("doesn't call generateActivityMechanics if lesson has no mechanics activity", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `No Mechanics Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityMechanics).not.toHaveBeenCalled();
    });

    test("doesn't call generateActivityMechanics if mechanics status is 'running'", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Mechanics Running Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "running",
          kind: "mechanics",
          lessonId: testLesson.id,
          organizationId,
          title: `Running Mechanics ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityMechanics).not.toHaveBeenCalled();
    });

    test("doesn't call generateActivityMechanics if mechanics status is 'completed'", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Mechanics Completed Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
      ]);

      const mechanicsActivity = await activityFixture({
        generationStatus: "completed",
        kind: "mechanics",
        lessonId: testLesson.id,
        organizationId,
        title: `Completed Mechanics ${randomUUID()}`,
      });

      await stepFixture({
        activityId: mechanicsActivity.id,
        content: { text: "Existing mechanics text", title: "Existing Mechanics" },
        position: 0,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityMechanics).not.toHaveBeenCalled();
    });

    test("doesn't call generateActivityMechanics if explanation steps are empty", async () => {
      vi.mocked(generateActivityExplanation).mockResolvedValueOnce({
        data: { steps: [] },
        systemPrompt: "test",
        usage: {} as Awaited<ReturnType<typeof generateActivityExplanation>>["usage"],
        userPrompt: "test",
      });

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Empty Exp Steps Mechanics Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "mechanics",
          lessonId: testLesson.id,
          organizationId,
          title: `Mechanics ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityMechanics).not.toHaveBeenCalled();
    });

    test("passes explanation steps to generateActivityMechanics", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Exp Steps Pass Mechanics Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "mechanics",
          lessonId: testLesson.id,
          organizationId,
          title: `Mechanics ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityMechanics).toHaveBeenCalledWith(
        expect.objectContaining({
          explanationSteps: [
            { text: "Explanation step 1 text", title: "Explanation Step 1" },
            { text: "Explanation step 2 text", title: "Explanation Step 2" },
          ],
        }),
      );
    });

    test("sets mechanics status to 'running' when generation starts", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Mechanics Running Status Lesson ${randomUUID()}`,
      });

      const activities = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "mechanics",
          lessonId: testLesson.id,
          organizationId,
          title: `Pending Mechanics ${randomUUID()}`,
        }),
      ]);

      const mechanicsActivity = activities[2];

      let capturedStatus: string | null = null;

      vi.mocked(generateActivityMechanics).mockImplementationOnce(async () => {
        const dbActivity = await prisma.activity.findUnique({
          where: { id: mechanicsActivity?.id },
        });
        capturedStatus = dbActivity?.generationStatus ?? null;

        return {
          data: {
            steps: [{ text: "Step text", title: "Step Title" }],
          },
          systemPrompt: "test",
          usage: {} as Awaited<ReturnType<typeof generateActivityMechanics>>["usage"],
          userPrompt: "test",
        };
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(capturedStatus).toBe("running");
    });

    test("sets mechanics status to 'failed' when generateActivityMechanics throws", async () => {
      vi.mocked(generateActivityMechanics).mockRejectedValueOnce(
        new Error("Mechanics generation failed"),
      );

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Mechanics Error Lesson ${randomUUID()}`,
      });

      const activities = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "mechanics",
          lessonId: testLesson.id,
          organizationId,
          title: `Error Mechanics ${randomUUID()}`,
        }),
      ]);

      const mechanicsActivity = activities[2];

      // With Promise.allSettled, launcher doesn't throw - just marks activity as failed
      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: mechanicsActivity?.id },
      });
      expect(dbActivity?.generationStatus).toBe("failed");
    });

    test("creates mechanics steps in database", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Mechanics Steps Lesson ${randomUUID()}`,
      });

      const activities = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "mechanics",
          lessonId: testLesson.id,
          organizationId,
          title: `Mechanics ${randomUUID()}`,
        }),
      ]);

      const mechanicsActivity = activities[2];

      await activityGenerationWorkflow(testLesson.id);

      const mechanicsSteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: mechanicsActivity?.id },
      });

      expect(mechanicsSteps).toHaveLength(2);
      expect(mechanicsSteps[0]?.content).toEqual({
        text: "Mechanics step 1 text",
        title: "Mechanics Step 1",
      });
      expect(mechanicsSteps[1]?.content).toEqual({
        text: "Mechanics step 2 text",
        title: "Mechanics Step 2",
      });
    });

    test("sets mechanics status to 'completed' after saving steps", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Mechanics Completed Status Lesson ${randomUUID()}`,
      });

      const activities = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "background",
          lessonId: testLesson.id,
          organizationId,
          title: `Background ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "mechanics",
          lessonId: testLesson.id,
          organizationId,
          title: `Mechanics ${randomUUID()}`,
        }),
      ]);

      const mechanicsActivity = activities[2];

      const initialActivity = await prisma.activity.findUnique({
        where: { id: mechanicsActivity?.id },
      });
      expect(initialActivity?.generationStatus).toBe("pending");

      await activityGenerationWorkflow(testLesson.id);

      const finalActivity = await prisma.activity.findUnique({
        where: { id: mechanicsActivity?.id },
      });
      expect(finalActivity?.generationStatus).toBe("completed");
      expect(finalActivity?.generationRunId).toBe("test-run-id");
    });
  });

  describe("unsupported activity kinds", () => {
    test("skips unsupported activity kinds (story, etc.)", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Unsupported Kind Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "story",
        lessonId: testLesson.id,
        organizationId,
        title: `Story Activity ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).not.toHaveBeenCalled();
      expect(generateActivityExplanation).not.toHaveBeenCalled();
      expect(generateActivityExplanationQuiz).not.toHaveBeenCalled();
    });
  });
});
