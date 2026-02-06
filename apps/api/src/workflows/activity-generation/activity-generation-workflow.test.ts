import { randomUUID } from "node:crypto";
import { generateActivityBackground } from "@zoonk/ai/tasks/activities/core/background";
import { generateActivityExamples } from "@zoonk/ai/tasks/activities/core/examples";
import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { generateActivityExplanationQuiz } from "@zoonk/ai/tasks/activities/core/explanation-quiz";
import { generateActivityMechanics } from "@zoonk/ai/tasks/activities/core/mechanics";
import { generateActivityStory } from "@zoonk/ai/tasks/activities/core/story";
import { generateStepVisuals } from "@zoonk/ai/tasks/steps/visual";
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

    test("creates quiz image URLs for selectImage options", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Quiz Images Lesson ${randomUUID()}`,
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

      const selectImageStep = quizSteps.find((step) => step.kind === "selectImage");
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test assertion on Prisma JSON field
      const content = selectImageStep?.content as { options: { url?: string }[] };

      expect(content.options[0]?.url).toBe("https://example.com/quiz-image.webp");
      expect(content.options[1]?.url).toBe("https://example.com/quiz-image.webp");
    });

    test("sets quiz status to 'completed' after saving", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Quiz Complete Lesson ${randomUUID()}`,
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
      expect(dbActivity?.generationRunId).toBe("test-run-id");
    });
  });

  describe("mechanics generation", () => {
    test("passes explanation steps to generateActivityMechanics", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Mech Steps Lesson ${randomUUID()}`,
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

    test("sets mechanics status to 'completed' after full pipeline", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Mech Complete Lesson ${randomUUID()}`,
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

      const mechActivity = activities[2];

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: mechActivity?.id },
      });
      expect(dbActivity?.generationStatus).toBe("completed");
    });
  });

  describe("examples generation", () => {
    test("doesn't call generateActivityExamples if lesson has no examples activity", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `No Examples Lesson ${randomUUID()}`,
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

      expect(generateActivityExamples).not.toHaveBeenCalled();
    });

    test("doesn't call generateActivityExamples if explanation steps are empty", async () => {
      vi.mocked(generateActivityExplanation).mockResolvedValueOnce({
        data: { steps: [] },
        systemPrompt: "test",
        usage: {} as Awaited<ReturnType<typeof generateActivityExplanation>>["usage"],
        userPrompt: "test",
      });

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Empty Exp For Examples Lesson ${randomUUID()}`,
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
          kind: "examples",
          lessonId: testLesson.id,
          organizationId,
          title: `Examples ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExamples).not.toHaveBeenCalled();
    });

    test("passes explanation steps to generateActivityExamples", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Examples Steps Lesson ${randomUUID()}`,
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
          kind: "examples",
          lessonId: testLesson.id,
          organizationId,
          title: `Examples ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExamples).toHaveBeenCalledWith(
        expect.objectContaining({
          explanationSteps: [
            { text: "Explanation step 1 text", title: "Explanation Step 1" },
            { text: "Explanation step 2 text", title: "Explanation Step 2" },
          ],
        }),
      );
    });

    test("sets examples status to 'failed' when generateActivityExamples throws", async () => {
      vi.mocked(generateActivityExamples).mockRejectedValueOnce(
        new Error("Examples generation failed"),
      );

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Examples Error Lesson ${randomUUID()}`,
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
          kind: "examples",
          lessonId: testLesson.id,
          organizationId,
          title: `Error Examples ${randomUUID()}`,
        }),
      ]);

      const examplesActivity = activities[2];

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: examplesActivity?.id },
      });
      expect(dbActivity?.generationStatus).toBe("failed");
    });

    test("creates examples steps in database", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Examples DB Steps Lesson ${randomUUID()}`,
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
          kind: "examples",
          lessonId: testLesson.id,
          organizationId,
          title: `Examples ${randomUUID()}`,
        }),
      ]);

      const examplesActivity = activities[2];

      await activityGenerationWorkflow(testLesson.id);

      const examplesSteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: examplesActivity?.id },
      });

      expect(examplesSteps).toHaveLength(2);
      expect(examplesSteps[0]?.content).toEqual({
        text: "Examples step 1 text",
        title: "Examples Step 1",
      });
      expect(examplesSteps[1]?.content).toEqual({
        text: "Examples step 2 text",
        title: "Examples Step 2",
      });
    });

    test("sets examples status to 'completed' after full pipeline", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Examples Complete Lesson ${randomUUID()}`,
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
          kind: "examples",
          lessonId: testLesson.id,
          organizationId,
          title: `Examples ${randomUUID()}`,
        }),
      ]);

      const examplesActivity = activities[2];

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: examplesActivity?.id },
      });
      expect(dbActivity?.generationStatus).toBe("completed");
      expect(dbActivity?.generationRunId).toBe("test-run-id");
    });
  });

  describe("story generation", () => {
    test("doesn't call generateActivityStory if lesson has no story activity", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `No Story Lesson ${randomUUID()}`,
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

      expect(generateActivityStory).not.toHaveBeenCalled();
    });

    test("doesn't call generateActivityStory if explanation steps are empty", async () => {
      vi.mocked(generateActivityExplanation).mockResolvedValueOnce({
        data: { steps: [] },
        systemPrompt: "test",
        usage: {} as Awaited<ReturnType<typeof generateActivityExplanation>>["usage"],
        userPrompt: "test",
      });

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Empty Exp For Story Lesson ${randomUUID()}`,
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
          kind: "story",
          lessonId: testLesson.id,
          organizationId,
          title: `Story ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityStory).not.toHaveBeenCalled();
    });

    test("passes explanation steps to generateActivityStory", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Story Steps Lesson ${randomUUID()}`,
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
          kind: "story",
          lessonId: testLesson.id,
          organizationId,
          title: `Story ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityStory).toHaveBeenCalledWith(
        expect.objectContaining({
          explanationSteps: [
            { text: "Explanation step 1 text", title: "Explanation Step 1" },
            { text: "Explanation step 2 text", title: "Explanation Step 2" },
          ],
        }),
      );
    });

    test("sets story status to 'failed' when generateActivityStory throws", async () => {
      vi.mocked(generateActivityStory).mockRejectedValueOnce(new Error("Story generation failed"));

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Story Error Lesson ${randomUUID()}`,
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
          kind: "story",
          lessonId: testLesson.id,
          organizationId,
          title: `Error Story ${randomUUID()}`,
        }),
      ]);

      const storyActivity = activities[2];

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: storyActivity?.id },
      });
      expect(dbActivity?.generationStatus).toBe("failed");
    });

    test("creates story steps in database with multipleChoice kind and correct content", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Story Steps DB Lesson ${randomUUID()}`,
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
          kind: "story",
          lessonId: testLesson.id,
          organizationId,
          title: `Story ${randomUUID()}`,
        }),
      ]);

      const storyActivity = activities[2];

      await activityGenerationWorkflow(testLesson.id);

      const storySteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: storyActivity?.id },
      });

      expect(storySteps).toHaveLength(1);
      expect(storySteps[0]?.kind).toBe("multipleChoice");
      expect(storySteps[0]?.content).toEqual({
        context: "Your colleague turns to you during a meeting...",
        options: [
          { feedback: "Great choice!", isCorrect: true, text: "Option A" },
          { feedback: "Not quite.", isCorrect: false, text: "Option B" },
          { feedback: "Try again.", isCorrect: false, text: "Option C" },
          { feedback: "Nope.", isCorrect: false, text: "Option D" },
        ],
        question: "What should you do?",
      });
    });

    test("sets story status to 'completed' after saving", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Story Complete Lesson ${randomUUID()}`,
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
          kind: "story",
          lessonId: testLesson.id,
          organizationId,
          title: `Story ${randomUUID()}`,
        }),
      ]);

      const storyActivity = activities[2];

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: storyActivity?.id },
      });
      expect(dbActivity?.generationStatus).toBe("completed");
      expect(dbActivity?.generationRunId).toBe("test-run-id");
    });
  });

  describe("resumption", () => {
    test("skips content generation if steps already exist in DB", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Resume Skip Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Completed BG ${randomUUID()}`,
      });

      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "Existing background text", title: "Existing Background" },
        position: 0,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).not.toHaveBeenCalled();
    });

    test("uses existing background steps for explanation when resuming", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Resume BG For Exp Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Completed BG ${randomUUID()}`,
      });

      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "Existing BG text", title: "Existing BG" },
        position: 0,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Pending Exp ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).not.toHaveBeenCalled();
      expect(generateActivityExplanation).toHaveBeenCalledWith(
        expect.objectContaining({
          backgroundSteps: [{ text: "Existing BG text", title: "Existing BG" }],
        }),
      );
    });

    test("skips visuals if ALL DB steps already have visual data", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Resume Visuals Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `BG With Visuals ${randomUUID()}`,
      });

      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "Step text", title: "Step" },
        position: 0,
        visualContent: { prompt: "A prompt", url: "https://example.com/existing.webp" },
        visualKind: "image",
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).not.toHaveBeenCalled();
      expect(generateStepVisuals).not.toHaveBeenCalled();
    });

    test("skips images if ALL image steps already have URLs", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Resume Images Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `BG With Images ${randomUUID()}`,
      });

      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "Step text", title: "Step" },
        position: 0,
        visualContent: { prompt: "A prompt", url: "https://example.com/existing.webp" },
        visualKind: "image",
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateVisualStepImage).not.toHaveBeenCalled();
    });

    test("skips quiz content if quiz steps already exist in DB", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Resume Quiz Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `BG ${randomUUID()}`,
      });

      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "BG text", title: "BG" },
        position: 0,
      });

      const explanationActivity = await activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Exp ${randomUUID()}`,
      });

      await stepFixture({
        activityId: explanationActivity.id,
        content: { text: "Exp text", title: "Exp" },
        position: 0,
      });

      const quizActivity = await activityFixture({
        generationStatus: "running",
        kind: "quiz",
        lessonId: testLesson.id,
        organizationId,
        title: `Quiz with steps ${randomUUID()}`,
      });

      await stepFixture({
        activityId: quizActivity.id,
        content: {
          context: "Test",
          options: [{ feedback: "Yes", isCorrect: true, text: "A" }],
          question: "Q?",
        },
        kind: "multipleChoice",
        position: 0,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanationQuiz).not.toHaveBeenCalled();
    });

    test("re-runs failed background when re-triggered", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Retry Failed BG Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "failed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Failed BG Retry ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).toHaveBeenCalled();
    });

    test("re-runs failed explanation when background has steps", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Retry Failed Exp Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `BG for Failed Exp ${randomUUID()}`,
      });

      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "Background content", title: "Background" },
        position: 0,
      });

      await activityFixture({
        generationStatus: "failed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Failed Exp Retry ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).not.toHaveBeenCalled();
      expect(generateActivityExplanation).toHaveBeenCalled();
    });

    test("partial failure: background completed + explanation failed → re-trigger only runs explanation", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Partial Retry Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Completed BG Partial ${randomUUID()}`,
      });

      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "Background for partial", title: "Partial BG" },
        position: 0,
      });

      const explanationActivity = await activityFixture({
        generationStatus: "failed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Failed Exp Partial ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).not.toHaveBeenCalled();
      expect(generateActivityExplanation).toHaveBeenCalled();

      const dbActivity = await prisma.activity.findUnique({
        where: { id: explanationActivity.id },
      });
      expect(dbActivity?.generationStatus).toBe("completed");
    });

    test("partial completion: background completed + explanation pending works correctly", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Partial Complete Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Partial Complete BG ${randomUUID()}`,
      });

      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "Partial complete BG text", title: "Partial BG" },
        position: 0,
      });

      const explanationActivity = await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Partial Complete Exp ${randomUUID()}`,
      });

      const quizActivity = await activityFixture({
        generationStatus: "pending",
        kind: "quiz",
        lessonId: testLesson.id,
        organizationId,
        title: `Partial Complete Quiz ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).not.toHaveBeenCalled();
      expect(generateActivityExplanation).toHaveBeenCalledWith(
        expect.objectContaining({
          backgroundSteps: [{ text: "Partial complete BG text", title: "Partial BG" }],
        }),
      );
      expect(generateActivityExplanationQuiz).toHaveBeenCalled();

      const dbExplanation = await prisma.activity.findUnique({
        where: { id: explanationActivity.id },
      });
      expect(dbExplanation?.generationStatus).toBe("completed");

      const dbQuiz = await prisma.activity.findUnique({
        where: { id: quizActivity.id },
      });
      expect(dbQuiz?.generationStatus).toBe("completed");
    });
  });

  describe("dependency cascade failures", () => {
    test("background returns empty → explanation marked as failed", async () => {
      vi.mocked(generateActivityBackground).mockResolvedValueOnce({
        data: { steps: [] },
        systemPrompt: "test",
        usage: {} as Awaited<ReturnType<typeof generateActivityBackground>>["usage"],
        userPrompt: "test",
      });

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Cascade Fail Lesson ${randomUUID()}`,
      });

      const [bgActivity, expActivity] = await Promise.all([
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

      const dbBg = await prisma.activity.findUnique({ where: { id: bgActivity.id } });
      expect(dbBg?.generationStatus).toBe("failed");

      const dbExp = await prisma.activity.findUnique({ where: { id: expActivity.id } });
      expect(dbExp?.generationStatus).toBe("failed");

      expect(generateActivityExplanation).not.toHaveBeenCalled();
    });

    test("explanation returns empty → mechanics, quiz, examples, and story marked as failed", async () => {
      vi.mocked(generateActivityExplanation).mockResolvedValueOnce({
        data: { steps: [] },
        systemPrompt: "test",
        usage: {} as Awaited<ReturnType<typeof generateActivityExplanation>>["usage"],
        userPrompt: "test",
      });

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Exp Empty Cascade Lesson ${randomUUID()}`,
      });

      const [, expActivity, mechActivity, quizActivity, examplesActivity, storyActivity] =
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
          activityFixture({
            generationStatus: "pending",
            kind: "quiz",
            lessonId: testLesson.id,
            organizationId,
            title: `Quiz ${randomUUID()}`,
          }),
          activityFixture({
            generationStatus: "pending",
            kind: "examples",
            lessonId: testLesson.id,
            organizationId,
            title: `Examples ${randomUUID()}`,
          }),
          activityFixture({
            generationStatus: "pending",
            kind: "story",
            lessonId: testLesson.id,
            organizationId,
            title: `Story ${randomUUID()}`,
          }),
        ]);

      await activityGenerationWorkflow(testLesson.id);

      const dbExp = await prisma.activity.findUnique({ where: { id: expActivity.id } });
      expect(dbExp?.generationStatus).toBe("failed");

      const dbMech = await prisma.activity.findUnique({ where: { id: mechActivity.id } });
      expect(dbMech?.generationStatus).toBe("failed");

      const dbQuiz = await prisma.activity.findUnique({ where: { id: quizActivity.id } });
      expect(dbQuiz?.generationStatus).toBe("failed");

      const dbExamples = await prisma.activity.findUnique({ where: { id: examplesActivity.id } });
      expect(dbExamples?.generationStatus).toBe("failed");

      const dbStory = await prisma.activity.findUnique({ where: { id: storyActivity.id } });
      expect(dbStory?.generationStatus).toBe("failed");

      expect(generateActivityMechanics).not.toHaveBeenCalled();
      expect(generateActivityExplanationQuiz).not.toHaveBeenCalled();
      expect(generateActivityExamples).not.toHaveBeenCalled();
      expect(generateActivityStory).not.toHaveBeenCalled();
    });
  });

  describe("error isolation", () => {
    test("one activity kind fails → others still complete", async () => {
      vi.mocked(generateActivityExplanation).mockRejectedValueOnce(new Error("Explanation failed"));

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Isolation Lesson ${randomUUID()}`,
      });

      const [bgActivity, expActivity] = await Promise.all([
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

      const dbBg = await prisma.activity.findUnique({ where: { id: bgActivity.id } });
      expect(dbBg?.generationStatus).toBe("completed");

      const dbExp = await prisma.activity.findUnique({ where: { id: expActivity.id } });
      expect(dbExp?.generationStatus).toBe("failed");
    });
  });

  describe("full pipeline", () => {
    test("generates all 6 activities end to end", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Full Pipeline Lesson ${randomUUID()}`,
      });

      const [bgActivity, expActivity, mechActivity, quizActivity, examplesActivity, storyActivity] =
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
          activityFixture({
            generationStatus: "pending",
            kind: "quiz",
            lessonId: testLesson.id,
            organizationId,
            title: `Quiz ${randomUUID()}`,
          }),
          activityFixture({
            generationStatus: "pending",
            kind: "examples",
            lessonId: testLesson.id,
            organizationId,
            title: `Examples ${randomUUID()}`,
          }),
          activityFixture({
            generationStatus: "pending",
            kind: "story",
            lessonId: testLesson.id,
            organizationId,
            title: `Story ${randomUUID()}`,
          }),
        ]);

      await activityGenerationWorkflow(testLesson.id);

      // All 6 activities should be completed
      const [dbBg, dbExp, dbMech, dbQuiz, dbExamples, dbStory] = await Promise.all([
        prisma.activity.findUnique({ where: { id: bgActivity.id } }),
        prisma.activity.findUnique({ where: { id: expActivity.id } }),
        prisma.activity.findUnique({ where: { id: mechActivity.id } }),
        prisma.activity.findUnique({ where: { id: quizActivity.id } }),
        prisma.activity.findUnique({ where: { id: examplesActivity.id } }),
        prisma.activity.findUnique({ where: { id: storyActivity.id } }),
      ]);

      expect(dbBg?.generationStatus).toBe("completed");
      expect(dbExp?.generationStatus).toBe("completed");
      expect(dbMech?.generationStatus).toBe("completed");
      expect(dbQuiz?.generationStatus).toBe("completed");
      expect(dbExamples?.generationStatus).toBe("completed");
      expect(dbStory?.generationStatus).toBe("completed");

      // All AI tasks should have been called
      expect(generateActivityBackground).toHaveBeenCalledOnce();
      expect(generateActivityExplanation).toHaveBeenCalledOnce();
      expect(generateActivityMechanics).toHaveBeenCalledOnce();
      expect(generateActivityExplanationQuiz).toHaveBeenCalledOnce();
      expect(generateActivityExamples).toHaveBeenCalledOnce();
      expect(generateActivityStory).toHaveBeenCalledOnce();

      // Steps should be in DB
      const bgSteps = await prisma.step.findMany({ where: { activityId: bgActivity.id } });
      const expSteps = await prisma.step.findMany({ where: { activityId: expActivity.id } });
      const mechSteps = await prisma.step.findMany({ where: { activityId: mechActivity.id } });
      const quizSteps = await prisma.step.findMany({ where: { activityId: quizActivity.id } });
      const examplesSteps = await prisma.step.findMany({
        where: { activityId: examplesActivity.id },
      });
      const storySteps = await prisma.step.findMany({
        where: { activityId: storyActivity.id },
      });

      expect(bgSteps.length).toBeGreaterThan(0);
      expect(expSteps.length).toBeGreaterThan(0);
      expect(mechSteps.length).toBeGreaterThan(0);
      expect(quizSteps.length).toBeGreaterThan(0);
      expect(examplesSteps.length).toBeGreaterThan(0);
      expect(storySteps.length).toBeGreaterThan(0);
    });
  });

  describe("save step", () => {
    test("save skips when current DB status is 'failed'", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Save Skip Failed Lesson ${randomUUID()}`,
      });

      // Background will generate content fine but then we manually set it to failed
      // before the save step runs
      const backgroundActivity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `BG Save Skip ${randomUUID()}`,
      });

      // Make visuals fail so activity gets marked as failed
      vi.mocked(generateStepVisuals).mockRejectedValueOnce(new Error("Visuals failed"));

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: backgroundActivity.id },
      });
      // Should be "failed" because visuals failed and save step should have skipped
      expect(dbActivity?.generationStatus).toBe("failed");
    });

    test("save skips when current DB status is already 'completed'", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Save Skip Completed Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Already Completed BG ${randomUUID()}`,
      });

      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "Existing", title: "Existing" },
        position: 0,
        visualContent: { prompt: "test", url: "https://example.com/existing.webp" },
        visualKind: "image",
      });

      await activityGenerationWorkflow(testLesson.id);

      // Should still be completed with no changes
      const dbActivity = await prisma.activity.findUnique({
        where: { id: backgroundActivity.id },
      });
      expect(dbActivity?.generationStatus).toBe("completed");
    });
  });

  describe("status integrity", () => {
    test("status is 'completed' but no steps in DB → returns empty without regenerating", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Incomplete Completed Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Completed No Steps ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      // Should NOT regenerate - completed means done
      expect(generateActivityBackground).not.toHaveBeenCalled();
    });

    test("status is 'running' → skips without using existing steps", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Running With Steps Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "running",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Running With Steps ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      // Running means another workflow is handling it - skip entirely
      expect(generateActivityBackground).not.toHaveBeenCalled();
    });

    test("failed status with existing steps → deletes steps and regenerates", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Failed With Steps Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "failed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Failed With Steps ${randomUUID()}`,
      });

      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "Failed but has step", title: "Failed Step" },
        position: 0,
      });

      await activityGenerationWorkflow(testLesson.id);

      // Should delete old steps and regenerate
      expect(generateActivityBackground).toHaveBeenCalled();

      // Old steps should be replaced by new ones
      const steps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: backgroundActivity.id },
      });
      expect(steps).toHaveLength(2);
      expect(steps[0]?.content).toEqual({
        text: "Background step 1 text",
        title: "Background Step 1",
      });
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
