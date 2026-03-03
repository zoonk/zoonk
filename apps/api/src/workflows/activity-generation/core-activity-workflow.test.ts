import { randomUUID } from "node:crypto";
import { generateActivityBackground } from "@zoonk/ai/tasks/activities/core/background";
import { generateActivityChallenge } from "@zoonk/ai/tasks/activities/core/challenge";
import { generateActivityExamples } from "@zoonk/ai/tasks/activities/core/examples";
import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { generateActivityMechanics } from "@zoonk/ai/tasks/activities/core/mechanics";
import { generateActivityQuiz } from "@zoonk/ai/tasks/activities/core/quiz";
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
import { getNeighboringConceptsStep } from "./steps/get-neighboring-concepts-step";

function getStreamedMessages(): Record<string, string>[] {
  return mockStreamWrite.mock.calls.map(
    (call: string[]) => JSON.parse(call[0]!.replace("data: ", "").trim()) as Record<string, string>,
  );
}

vi.mock("./steps/get-neighboring-concepts-step", () => ({
  getNeighboringConceptsStep: vi.fn().mockResolvedValue([]),
}));

const mockStreamWrite = vi.hoisted(() => vi.fn().mockResolvedValue(null));

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: mockStreamWrite,
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

vi.mock("@zoonk/ai/tasks/activities/core/quiz", () => ({
  generateActivityQuiz: vi.fn().mockResolvedValue({
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

describe("core activity workflow", () => {
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

      for (const step of backgroundSteps) {
        expect(step.isPublished).toBeTruthy();
      }

      expect(backgroundSteps[0]?.content).toEqual({
        text: "Background step 1 text",
        title: "Background Step 1",
        variant: "text",
      });
      expect(backgroundSteps[1]?.content).toEqual({
        text: "Background step 2 text",
        title: "Background Step 2",
        variant: "text",
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

    test("passes concept and neighboringConcepts to generateActivityExplanation", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Concept A"],
        organizationId,
        title: `Exp Concept Params Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Concept A`,
      });

      vi.mocked(getNeighboringConceptsStep).mockResolvedValueOnce(["Neighbor 1"]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanation).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: "Concept A",
          neighboringConcepts: ["Neighbor 1"],
        }),
      );
    });

    test("sets explanation status to 'running' when generation starts", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Exp Running Status Lesson ${randomUUID()}`,
      });

      const explanationActivity = await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Pending Explanation ${randomUUID()}`,
      });

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

      const explanationActivity = await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Error Explanation ${randomUUID()}`,
      });

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

      const explanationActivity = await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Explanation ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const explanationSteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: explanationActivity.id },
      });

      expect(explanationSteps).toHaveLength(2);

      for (const step of explanationSteps) {
        expect(step.isPublished).toBeTruthy();
      }

      expect(explanationSteps[0]?.content).toEqual({
        text: "Explanation step 1 text",
        title: "Explanation Step 1",
        variant: "text",
      });
      expect(explanationSteps[1]?.content).toEqual({
        text: "Explanation step 2 text",
        title: "Explanation Step 2",
        variant: "text",
      });
    });

    test("sets explanation status to 'completed' after saving steps", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Exp Completed Status Lesson ${randomUUID()}`,
      });

      const explanationActivity = await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Explanation ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const finalActivity = await prisma.activity.findUnique({
        where: { id: explanationActivity.id },
      });
      expect(finalActivity?.generationStatus).toBe("completed");
      expect(finalActivity?.generationRunId).toBe("test-run-id");
    });
  });

  describe("quiz generation", () => {
    test("doesn't call generateActivityQuiz if lesson has no quiz activity", async () => {
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

      expect(generateActivityQuiz).not.toHaveBeenCalled();
    });

    test("doesn't call generateActivityQuiz if explanation steps are empty", async () => {
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

      expect(generateActivityQuiz).not.toHaveBeenCalled();
    });

    test("passes explanation steps to generateActivityQuiz", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Exp Steps Pass Quiz Lesson ${randomUUID()}`,
      });

      await Promise.all([
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

      expect(generateActivityQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          explanationSteps: [
            { text: "Explanation step 1 text", title: "Explanation Step 1" },
            { text: "Explanation step 2 text", title: "Explanation Step 2" },
          ],
        }),
      );
    });

    test("sets quiz status to 'failed' when generateActivityQuiz throws", async () => {
      vi.mocked(generateActivityQuiz).mockRejectedValueOnce(new Error("Quiz generation failed"));

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

      for (const step of quizSteps) {
        expect(step.isPublished).toBeTruthy();
      }

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
    test("passes concepts and neighboringConcepts to generateActivityMechanics", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Concept X"],
        organizationId,
        title: `Mech Steps Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "mechanics",
        lessonId: testLesson.id,
        organizationId,
        title: `Mechanics ${randomUUID()}`,
      });

      vi.mocked(getNeighboringConceptsStep).mockResolvedValueOnce(["Neighbor X"]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityMechanics).toHaveBeenCalledWith(
        expect.objectContaining({
          concepts: ["Concept X"],
          neighboringConcepts: ["Neighbor X"],
        }),
      );
    });

    test("sets mechanics status to 'completed' after full pipeline", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `Mech Complete Lesson ${randomUUID()}`,
      });

      const mechActivity = await activityFixture({
        generationStatus: "pending",
        kind: "mechanics",
        lessonId: testLesson.id,
        organizationId,
        title: `Mechanics ${randomUUID()}`,
      });

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

      await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Background ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExamples).not.toHaveBeenCalled();
    });

    test("passes concepts and neighboringConcepts to generateActivityExamples", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Concept Y"],
        organizationId,
        title: `Examples Steps Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "examples",
        lessonId: testLesson.id,
        organizationId,
        title: `Examples ${randomUUID()}`,
      });

      vi.mocked(getNeighboringConceptsStep).mockResolvedValueOnce(["Neighbor Y"]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExamples).toHaveBeenCalledWith(
        expect.objectContaining({
          concepts: ["Concept Y"],
          neighboringConcepts: ["Neighbor Y"],
        }),
      );
    });

    test("sets examples status to 'failed' when generateActivityExamples throws", async () => {
      vi.mocked(generateActivityExamples).mockRejectedValueOnce(
        new Error("Examples generation failed"),
      );

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `Examples Error Lesson ${randomUUID()}`,
      });

      const examplesActivity = await activityFixture({
        generationStatus: "pending",
        kind: "examples",
        lessonId: testLesson.id,
        organizationId,
        title: `Error Examples ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: examplesActivity?.id },
      });
      expect(dbActivity?.generationStatus).toBe("failed");
    });

    test("creates examples steps in database", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `Examples DB Steps Lesson ${randomUUID()}`,
      });

      const examplesActivity = await activityFixture({
        generationStatus: "pending",
        kind: "examples",
        lessonId: testLesson.id,
        organizationId,
        title: `Examples ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const examplesSteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: examplesActivity?.id },
      });

      expect(examplesSteps).toHaveLength(2);

      for (const step of examplesSteps) {
        expect(step.isPublished).toBeTruthy();
      }

      expect(examplesSteps[0]?.content).toEqual({
        text: "Examples step 1 text",
        title: "Examples Step 1",
        variant: "text",
      });
      expect(examplesSteps[1]?.content).toEqual({
        text: "Examples step 2 text",
        title: "Examples Step 2",
        variant: "text",
      });
    });

    test("sets examples status to 'completed' after full pipeline", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `Examples Complete Lesson ${randomUUID()}`,
      });

      const examplesActivity = await activityFixture({
        generationStatus: "pending",
        kind: "examples",
        lessonId: testLesson.id,
        organizationId,
        title: `Examples ${randomUUID()}`,
      });

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

      await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Background ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityStory).not.toHaveBeenCalled();
    });

    test("passes concepts and neighboringConcepts to generateActivityStory", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Concept S"],
        organizationId,
        title: `Story Steps Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "story",
        lessonId: testLesson.id,
        organizationId,
        title: `Story ${randomUUID()}`,
      });

      vi.mocked(getNeighboringConceptsStep).mockResolvedValueOnce(["Neighbor S"]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityStory).toHaveBeenCalledWith(
        expect.objectContaining({
          concepts: ["Concept S"],
          neighboringConcepts: ["Neighbor S"],
        }),
      );
    });

    test("sets story status to 'failed' when generateActivityStory throws", async () => {
      vi.mocked(generateActivityStory).mockRejectedValueOnce(new Error("Story generation failed"));

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `Story Error Lesson ${randomUUID()}`,
      });

      const storyActivity = await activityFixture({
        generationStatus: "pending",
        kind: "story",
        lessonId: testLesson.id,
        organizationId,
        title: `Error Story ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: storyActivity?.id },
      });
      expect(dbActivity?.generationStatus).toBe("failed");
    });

    test("creates story steps in database with multipleChoice kind and correct content", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `Story Steps DB Lesson ${randomUUID()}`,
      });

      const storyActivity = await activityFixture({
        generationStatus: "pending",
        kind: "story",
        lessonId: testLesson.id,
        organizationId,
        title: `Story ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const storySteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: storyActivity?.id },
      });

      expect(storySteps).toHaveLength(1);
      expect(storySteps[0]?.isPublished).toBeTruthy();
      expect(storySteps[0]?.kind).toBe("multipleChoice");
      expect(storySteps[0]?.content).toEqual({
        context: "Your colleague turns to you during a meeting...",
        kind: "core",
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
        concepts: ["Test Concept"],
        organizationId,
        title: `Story Complete Lesson ${randomUUID()}`,
      });

      const storyActivity = await activityFixture({
        generationStatus: "pending",
        kind: "story",
        lessonId: testLesson.id,
        organizationId,
        title: `Story ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: storyActivity?.id },
      });
      expect(dbActivity?.generationStatus).toBe("completed");
      expect(dbActivity?.generationRunId).toBe("test-run-id");
    });
  });

  describe("challenge generation", () => {
    test("doesn't call generateActivityChallenge if lesson has no challenge activity", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `No Challenge Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Background ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityChallenge).not.toHaveBeenCalled();
    });

    test("passes concepts and neighboringConcepts to generateActivityChallenge", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Concept C"],
        organizationId,
        title: `Challenge Steps Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "challenge",
        lessonId: testLesson.id,
        organizationId,
        title: `Challenge ${randomUUID()}`,
      });

      vi.mocked(getNeighboringConceptsStep).mockResolvedValueOnce(["Neighbor C"]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityChallenge).toHaveBeenCalledWith(
        expect.objectContaining({
          concepts: ["Concept C"],
          neighboringConcepts: ["Neighbor C"],
        }),
      );
    });

    test("sets challenge status to 'failed' when generateActivityChallenge throws", async () => {
      vi.mocked(generateActivityChallenge).mockRejectedValueOnce(
        new Error("Challenge generation failed"),
      );

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `Challenge Error Lesson ${randomUUID()}`,
      });

      const challengeActivity = await activityFixture({
        generationStatus: "pending",
        kind: "challenge",
        lessonId: testLesson.id,
        organizationId,
        title: `Error Challenge ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: challengeActivity?.id },
      });
      expect(dbActivity?.generationStatus).toBe("failed");
    });

    test("creates steps in DB with intro, multipleChoice, and reflection steps", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `Challenge Steps DB Lesson ${randomUUID()}`,
      });

      const challengeActivity = await activityFixture({
        generationStatus: "pending",
        kind: "challenge",
        lessonId: testLesson.id,
        organizationId,
        title: `Challenge ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const challengeSteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: challengeActivity?.id },
      });

      expect(challengeSteps).toHaveLength(3);

      expect(challengeSteps[0]?.kind).toBe("static");
      expect(challengeSteps[0]?.content).toEqual({
        text: "Welcome to the challenge scenario...",
        title: "",
        variant: "text",
      });

      expect(challengeSteps[1]?.kind).toBe("multipleChoice");
      expect(challengeSteps[1]?.content).toEqual({
        context: "Your team lead asks you to choose...",
        kind: "challenge",
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
      });

      expect(challengeSteps[2]?.kind).toBe("static");
      expect(challengeSteps[2]?.content).toEqual({
        text: "Every decision involves trade-offs...",
        title: "",
        variant: "text",
      });
    });

    test("stores intro and reflection as static steps instead of activity content", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `Challenge Content Lesson ${randomUUID()}`,
      });

      const challengeActivity = await activityFixture({
        generationStatus: "pending",
        kind: "challenge",
        lessonId: testLesson.id,
        organizationId,
        title: `Challenge ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const challengeSteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: challengeActivity?.id },
      });

      const introStep = challengeSteps[0];
      const reflectionStep = challengeSteps.at(-1);

      expect(introStep?.kind).toBe("static");
      expect(introStep?.position).toBe(0);
      expect(introStep?.content).toEqual({
        text: "Welcome to the challenge scenario...",
        title: "",
        variant: "text",
      });

      expect(reflectionStep?.kind).toBe("static");
      expect(reflectionStep?.position).toBe(2);
      expect(reflectionStep?.content).toEqual({
        text: "Every decision involves trade-offs...",
        title: "",
        variant: "text",
      });
    });

    test("sets challenge status to 'completed' after saving", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `Challenge Complete Lesson ${randomUUID()}`,
      });

      const challengeActivity = await activityFixture({
        generationStatus: "pending",
        kind: "challenge",
        lessonId: testLesson.id,
        organizationId,
        title: `Challenge ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: challengeActivity?.id },
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
        content: {
          text: "Existing background text",
          title: "Existing Background",
          variant: "text",
        },
        position: 0,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).not.toHaveBeenCalled();
    });

    test("skips background when completed and still generates explanation", async () => {
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
        content: { text: "Existing BG text", title: "Existing BG", variant: "text" },
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
      expect(generateActivityExplanation).toHaveBeenCalled();
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
        content: { text: "Step text", title: "Step", variant: "text" },
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
        content: { text: "Step text", title: "Step", variant: "text" },
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
        content: { text: "BG text", title: "BG", variant: "text" },
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
        content: { text: "Exp text", title: "Exp", variant: "text" },
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
          kind: "core",
          options: [{ feedback: "Yes", isCorrect: true, text: "A" }],
          question: "Q?",
        },
        kind: "multipleChoice",
        position: 0,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityQuiz).not.toHaveBeenCalled();
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
        content: { text: "Background content", title: "Background", variant: "text" },
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
        content: {
          text: "Background for partial",
          title: "Partial BG",
          variant: "text",
        },
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

    test("partial completion: background completed + explanation pending + quiz pending works correctly", async () => {
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
        content: {
          text: "Partial complete BG text",
          title: "Partial BG",
          variant: "text",
        },
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
      expect(generateActivityExplanation).toHaveBeenCalled();
      expect(generateActivityQuiz).toHaveBeenCalled();

      const [dbExplanation, dbQuiz] = await Promise.all([
        prisma.activity.findUnique({ where: { id: explanationActivity.id } }),
        prisma.activity.findUnique({ where: { id: quizActivity.id } }),
      ]);

      expect(dbExplanation?.generationStatus).toBe("completed");
      expect(dbQuiz?.generationStatus).toBe("completed");
    });
  });

  describe("dependency cascade failures", () => {
    test("explanation returns empty → quiz marked as failed (quiz depends on explanation)", async () => {
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

      const [expActivity, quizActivity] = await Promise.all([
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

      const [dbExp, dbQuiz] = await Promise.all([
        prisma.activity.findUnique({ where: { id: expActivity.id } }),
        prisma.activity.findUnique({ where: { id: quizActivity.id } }),
      ]);

      expect(dbExp?.generationStatus).toBe("failed");
      expect(dbQuiz?.generationStatus).toBe("failed");

      expect(generateActivityQuiz).not.toHaveBeenCalled();
    });

    test("empty concepts → mechanics, examples, story, and challenge marked as failed", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: [],
        organizationId,
        title: `Empty Concepts Cascade Lesson ${randomUUID()}`,
      });

      const [mechActivity, examplesActivity, storyActivity, challengeActivity] = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "mechanics",
          lessonId: testLesson.id,
          organizationId,
          title: `Mechanics ${randomUUID()}`,
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
        activityFixture({
          generationStatus: "pending",
          kind: "challenge",
          lessonId: testLesson.id,
          organizationId,
          title: `Challenge ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      const [dbMech, dbExamples, dbStory, dbChallenge] = await Promise.all([
        prisma.activity.findUnique({ where: { id: mechActivity.id } }),
        prisma.activity.findUnique({ where: { id: examplesActivity.id } }),
        prisma.activity.findUnique({ where: { id: storyActivity.id } }),
        prisma.activity.findUnique({ where: { id: challengeActivity.id } }),
      ]);

      expect(dbMech?.generationStatus).toBe("failed");
      expect(dbExamples?.generationStatus).toBe("failed");
      expect(dbStory?.generationStatus).toBe("failed");
      expect(dbChallenge?.generationStatus).toBe("failed");

      expect(generateActivityMechanics).not.toHaveBeenCalled();
      expect(generateActivityExamples).not.toHaveBeenCalled();
      expect(generateActivityStory).not.toHaveBeenCalled();
      expect(generateActivityChallenge).not.toHaveBeenCalled();
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

      const [dbBg, dbExp] = await Promise.all([
        prisma.activity.findUnique({ where: { id: bgActivity.id } }),
        prisma.activity.findUnique({ where: { id: expActivity.id } }),
      ]);

      expect(dbBg?.generationStatus).toBe("completed");
      expect(dbExp?.generationStatus).toBe("failed");
    });
  });

  describe("full pipeline", () => {
    test("generates all 7 activities end to end", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `Full Pipeline Lesson ${randomUUID()}`,
      });

      const [
        bgActivity,
        expActivity,
        mechActivity,
        quizActivity,
        examplesActivity,
        storyActivity,
        challengeActivity,
      ] = await Promise.all([
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
        activityFixture({
          generationStatus: "pending",
          kind: "challenge",
          lessonId: testLesson.id,
          organizationId,
          title: `Challenge ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      const [dbBg, dbExp, dbMech, dbQuiz, dbExamples, dbStory, dbChallenge] = await Promise.all([
        prisma.activity.findUnique({ where: { id: bgActivity.id } }),
        prisma.activity.findUnique({ where: { id: expActivity.id } }),
        prisma.activity.findUnique({ where: { id: mechActivity.id } }),
        prisma.activity.findUnique({ where: { id: quizActivity.id } }),
        prisma.activity.findUnique({ where: { id: examplesActivity.id } }),
        prisma.activity.findUnique({ where: { id: storyActivity.id } }),
        prisma.activity.findUnique({ where: { id: challengeActivity.id } }),
      ]);

      expect(dbBg?.generationStatus).toBe("completed");
      expect(dbExp?.generationStatus).toBe("completed");
      expect(dbMech?.generationStatus).toBe("completed");
      expect(dbQuiz?.generationStatus).toBe("completed");
      expect(dbExamples?.generationStatus).toBe("completed");
      expect(dbStory?.generationStatus).toBe("completed");
      expect(dbChallenge?.generationStatus).toBe("completed");

      expect(generateActivityBackground).toHaveBeenCalledOnce();
      expect(generateActivityExplanation).toHaveBeenCalledOnce();
      expect(generateActivityMechanics).toHaveBeenCalledOnce();
      expect(generateActivityQuiz).toHaveBeenCalledOnce();
      expect(generateActivityExamples).toHaveBeenCalledOnce();
      expect(generateActivityStory).toHaveBeenCalledOnce();
      expect(generateActivityChallenge).toHaveBeenCalledOnce();

      const [bgSteps, expSteps, mechSteps, quizSteps, examplesSteps, storySteps, challengeSteps] =
        await Promise.all([
          prisma.step.findMany({ where: { activityId: bgActivity.id } }),
          prisma.step.findMany({ where: { activityId: expActivity.id } }),
          prisma.step.findMany({ where: { activityId: mechActivity.id } }),
          prisma.step.findMany({ where: { activityId: quizActivity.id } }),
          prisma.step.findMany({ where: { activityId: examplesActivity.id } }),
          prisma.step.findMany({ where: { activityId: storyActivity.id } }),
          prisma.step.findMany({ where: { activityId: challengeActivity.id } }),
        ]);

      expect(bgSteps.length).toBeGreaterThan(0);
      expect(expSteps.length).toBeGreaterThan(0);
      expect(mechSteps.length).toBeGreaterThan(0);
      expect(quizSteps.length).toBeGreaterThan(0);
      expect(examplesSteps.length).toBeGreaterThan(0);
      expect(storySteps.length).toBeGreaterThan(0);
      expect(challengeSteps.length).toBeGreaterThan(0);

      for (const steps of [bgSteps, expSteps, mechSteps, examplesSteps]) {
        const imageSteps = steps.filter((step) => step.visualKind === "image");
        expect(imageSteps.length).toBeGreaterThan(0);

        for (const step of imageSteps) {
          expect(step.visualContent).toEqual(expect.objectContaining({ url: expect.any(String) }));
        }
      }
    });
  });

  describe("data integrity", () => {
    test("completed background has image URLs on all image steps", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `DI Background Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `DI Background ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const steps = await prisma.step.findMany({ where: { activityId: activity.id } });
      const imageSteps = steps.filter((step) => step.visualKind === "image");
      expect(imageSteps.length).toBeGreaterThan(0);

      for (const step of imageSteps) {
        expect(step.visualContent).toEqual(expect.objectContaining({ url: expect.any(String) }));
      }

      const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
      expect(dbActivity?.generationStatus).toBe("completed");
    });

    test("completed explanation has image URLs on all image steps", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `DI Explanation Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `DI Explanation ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const steps = await prisma.step.findMany({ where: { activityId: activity.id } });
      const imageSteps = steps.filter((step) => step.visualKind === "image");
      expect(imageSteps.length).toBeGreaterThan(0);

      for (const step of imageSteps) {
        expect(step.visualContent).toEqual(expect.objectContaining({ url: expect.any(String) }));
      }

      const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
      expect(dbActivity?.generationStatus).toBe("completed");
    });

    test("completed mechanics has image URLs on all image steps", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `DI Mechanics Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "mechanics",
        lessonId: testLesson.id,
        organizationId,
        title: `DI Mechanics ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const steps = await prisma.step.findMany({ where: { activityId: activity.id } });
      const imageSteps = steps.filter((step) => step.visualKind === "image");
      expect(imageSteps.length).toBeGreaterThan(0);

      for (const step of imageSteps) {
        expect(step.visualContent).toEqual(expect.objectContaining({ url: expect.any(String) }));
      }

      const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
      expect(dbActivity?.generationStatus).toBe("completed");
    });

    test("completed examples has image URLs on all image steps", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `DI Examples Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "examples",
        lessonId: testLesson.id,
        organizationId,
        title: `DI Examples ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const steps = await prisma.step.findMany({ where: { activityId: activity.id } });
      const imageSteps = steps.filter((step) => step.visualKind === "image");
      expect(imageSteps.length).toBeGreaterThan(0);

      for (const step of imageSteps) {
        expect(step.visualContent).toEqual(expect.objectContaining({ url: expect.any(String) }));
      }

      const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
      expect(dbActivity?.generationStatus).toBe("completed");
    });
  });

  describe("save step", () => {
    test("save skips when current DB status is 'failed'", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Save Skip Failed Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `BG Save Skip ${randomUUID()}`,
      });

      vi.mocked(generateStepVisuals).mockRejectedValueOnce(new Error("Visuals failed"));

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({ where: { id: backgroundActivity.id } });
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
        content: { text: "Existing", title: "Existing", variant: "text" },
        position: 0,
        visualContent: { prompt: "test", url: "https://example.com/existing.webp" },
        visualKind: "image",
      });

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({ where: { id: backgroundActivity.id } });
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
        content: { text: "Failed but has step", title: "Failed Step", variant: "text" },
        position: 0,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).toHaveBeenCalled();

      const steps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: backgroundActivity.id },
      });
      expect(steps).toHaveLength(2);
      expect(steps[0]?.content).toEqual({
        text: "Background step 1 text",
        title: "Background Step 1",
        variant: "text",
      });
    });
  });

  describe("multi-explanation behavior", () => {
    test("generates multiple explanation activities in parallel", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Concept A", "Concept B", "Concept C"],
        organizationId,
        title: `Multi Exp Lesson ${randomUUID()}`,
      });

      const [expA, expB, expC] = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Concept A",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Concept B",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: "Concept C",
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanation).toHaveBeenCalledTimes(3);

      expect(generateActivityExplanation).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: "Concept A",
          neighboringConcepts: ["Concept B", "Concept C"],
        }),
      );

      expect(generateActivityExplanation).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: "Concept B",
          neighboringConcepts: ["Concept A", "Concept C"],
        }),
      );

      expect(generateActivityExplanation).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: "Concept C",
          neighboringConcepts: ["Concept A", "Concept B"],
        }),
      );

      const [dbA, dbB, dbC] = await Promise.all([
        prisma.activity.findUnique({ where: { id: expA.id } }),
        prisma.activity.findUnique({ where: { id: expB.id } }),
        prisma.activity.findUnique({ where: { id: expC.id } }),
      ]);

      expect(dbA?.generationStatus).toBe("completed");
      expect(dbB?.generationStatus).toBe("completed");
      expect(dbC?.generationStatus).toBe("completed");
    });

    test("merges other lesson concepts with neighboring concepts", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Concept A", "Concept B"],
        organizationId,
        title: `Merge Concepts Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Concept A",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Concept B",
        }),
      ]);

      vi.mocked(getNeighboringConceptsStep).mockResolvedValueOnce(["Neighbor X", "Neighbor Y"]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanation).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: "Concept A",
          neighboringConcepts: ["Concept B", "Neighbor X", "Neighbor Y"],
        }),
      );

      expect(generateActivityExplanation).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: "Concept B",
          neighboringConcepts: ["Concept A", "Neighbor X", "Neighbor Y"],
        }),
      );
    });

    test("one explanation failure doesn't block others", async () => {
      vi.mocked(generateActivityExplanation).mockImplementation(async (params) => {
        if (params.concept === "Fail Concept") {
          throw new Error("First explanation failed");
        }
        return {
          data: { steps: [{ text: "Second exp text", title: "Second Exp" }] },
          systemPrompt: "test",
          usage: {} as Awaited<ReturnType<typeof generateActivityExplanation>>["usage"],
          userPrompt: "test",
        };
      });

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Fail Concept", "Pass Concept"],
        organizationId,
        title: `Partial Exp Fail Lesson ${randomUUID()}`,
      });

      const [failExp, passExp] = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Fail Concept",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Pass Concept",
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      const [dbFail, dbPass] = await Promise.all([
        prisma.activity.findUnique({ where: { id: failExp.id } }),
        prisma.activity.findUnique({ where: { id: passExp.id } }),
      ]);

      expect(dbFail?.generationStatus).toBe("failed");
      expect(dbPass?.generationStatus).toBe("completed");
    });
  });

  describe("explanation visuals and images", () => {
    test("generates visuals for each explanation activity", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Visual Concept A", "Visual Concept B"],
        organizationId,
        title: `Exp Visuals Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Visual Concept A",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Visual Concept B",
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      // 2 explanation activities + background/mechanics/examples = 5 calls total
      // but only if bg/mech/examples activities exist. Here we only have explanations,
      // so generateStepVisuals should be called once per explanation
      const calls = vi.mocked(generateStepVisuals).mock.calls;
      const explanationVisualCalls = calls.length;

      expect(explanationVisualCalls).toBeGreaterThanOrEqual(2);
    });

    test("generates images for explanation activities", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Image Exp Concept"],
        organizationId,
        title: `Exp Images Lesson ${randomUUID()}`,
      });

      const expActivity = await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        position: 1,
        title: "Image Exp Concept",
      });

      await activityGenerationWorkflow(testLesson.id);

      const expSteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: expActivity.id },
      });

      const imageStep = expSteps.find((step) => step.visualKind === "image");

      expect(imageStep).toBeDefined();
      expect(imageStep?.visualContent).toEqual(
        expect.objectContaining({
          prompt: expect.any(String),
          url: "https://example.com/image.webp",
        }),
      );
    });
  });

  describe("multi-quiz behavior", () => {
    test("creates two quizzes when lesson has 4+ concepts", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Q1", "Q2", "Q3", "Q4"],
        organizationId,
        title: `Two Quiz Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Q1",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Q2",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: "Q3",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 4,
          title: "Q4",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          position: 5,
          title: `Quiz 1 ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          position: 6,
          title: `Quiz 2 ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityQuiz).toHaveBeenCalledTimes(2);
    });

    test("quiz 1 gets first half of explanation steps, quiz 2 gets second half", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Half1A", "Half1B", "Half2A", "Half2B"],
        organizationId,
        title: `Quiz Split Lesson ${randomUUID()}`,
      });

      const conceptToStep: Record<string, { text: string; title: string }> = {
        Half1A: { text: "H1A text", title: "H1A" },
        Half1B: { text: "H1B text", title: "H1B" },
        Half2A: { text: "H2A text", title: "H2A" },
        Half2B: { text: "H2B text", title: "H2B" },
      };

      vi.mocked(generateActivityExplanation).mockImplementation(async (params) => {
        const step = conceptToStep[params.concept] ?? { text: "unknown", title: "unknown" };
        return {
          data: { steps: [step] },
          systemPrompt: "test",
          usage: {} as Awaited<ReturnType<typeof generateActivityExplanation>>["usage"],
          userPrompt: "test",
        };
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Half1A",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Half1B",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: "Half2A",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 4,
          title: "Half2B",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          position: 5,
          title: `Quiz 1 ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          position: 6,
          title: `Quiz 2 ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityQuiz).toHaveBeenCalledTimes(2);

      // Quiz 1 should get first half explanation steps (H1A, H1B)
      expect(generateActivityQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          explanationSteps: [
            { text: "H1A text", title: "H1A" },
            { text: "H1B text", title: "H1B" },
          ],
        }),
      );

      // Quiz 2 should get second half explanation steps (H2A, H2B)
      expect(generateActivityQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          explanationSteps: [
            { text: "H2A text", title: "H2A" },
            { text: "H2B text", title: "H2B" },
          ],
        }),
      );
    });

    test("single quiz gets all explanation steps when < 4 concepts", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Single A", "Single B"],
        organizationId,
        title: `Single Quiz Lesson ${randomUUID()}`,
      });

      vi.mocked(generateActivityExplanation).mockImplementation(async (params) => {
        const step =
          params.concept === "Single A"
            ? { text: "SA text", title: "SA" }
            : { text: "SB text", title: "SB" };
        return {
          data: { steps: [step] },
          systemPrompt: "test",
          usage: {} as Awaited<ReturnType<typeof generateActivityExplanation>>["usage"],
          userPrompt: "test",
        };
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Single A",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Single B",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: `Single Quiz ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityQuiz).toHaveBeenCalledOnce();
      expect(generateActivityQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          explanationSteps: [
            { text: "SA text", title: "SA" },
            { text: "SB text", title: "SB" },
          ],
        }),
      );
    });

    test("quiz 1 gets content when only one explanation result exists with two quizzes", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["OnlyConcept"],
        organizationId,
        title: `Single Explanation Two Quizzes ${randomUUID()}`,
      });

      vi.mocked(generateActivityExplanation).mockResolvedValue({
        data: { steps: [{ text: "Only text", title: "Only" }] },
        systemPrompt: "test",
        usage: {} as Awaited<ReturnType<typeof generateActivityExplanation>>["usage"],
        userPrompt: "test",
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "OnlyConcept",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: `Quiz 1 ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: `Quiz 2 ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      // Quiz 1 must get the single explanation result (not an empty array)
      expect(generateActivityQuiz).toHaveBeenCalledOnce();
      expect(generateActivityQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          explanationSteps: [{ text: "Only text", title: "Only" }],
        }),
      );
    });

    test("completes both quiz activities when lesson has two quizzes", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["QC1", "QC2", "QC3", "QC4"],
        organizationId,
        title: `Both Quizzes Complete Lesson ${randomUUID()}`,
      });

      const activities = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "QC1",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "QC2",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: "QC3",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 4,
          title: "QC4",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          position: 5,
          title: `Quiz Complete 1 ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          position: 6,
          title: `Quiz Complete 2 ${randomUUID()}`,
        }),
      ]);

      const quiz1 = activities[4];
      const quiz2 = activities[5];

      await activityGenerationWorkflow(testLesson.id);

      const [dbQuiz1, dbQuiz2] = await Promise.all([
        prisma.activity.findUnique({ where: { id: quiz1?.id } }),
        prisma.activity.findUnique({ where: { id: quiz2?.id } }),
      ]);

      expect(dbQuiz1?.generationStatus).toBe("completed");
      expect(dbQuiz2?.generationStatus).toBe("completed");
    });
  });

  describe("completeActivityStep", () => {
    test("completes multiple explanation activities in parallel", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Complete A", "Complete B", "Complete C"],
        organizationId,
        title: `Multi Exp Complete Lesson ${randomUUID()}`,
      });

      const [expA, expB, expC] = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Complete A",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Complete B",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: "Complete C",
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      const [dbA, dbB, dbC] = await Promise.all([
        prisma.activity.findUnique({ where: { id: expA.id } }),
        prisma.activity.findUnique({ where: { id: expB.id } }),
        prisma.activity.findUnique({ where: { id: expC.id } }),
      ]);

      expect(dbA?.generationStatus).toBe("completed");
      expect(dbB?.generationStatus).toBe("completed");
      expect(dbC?.generationStatus).toBe("completed");

      const streamedMessages = getStreamedMessages();

      expect(streamedMessages).toContainEqual({
        status: "completed",
        step: "setExplanationAsCompleted",
      });

      expect(streamedMessages).not.toContainEqual({
        status: "error",
        step: "setActivityAsCompleted",
      });
    });

    test("completes multiple quiz activities in parallel", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["MQ1", "MQ2", "MQ3", "MQ4"],
        organizationId,
        title: `Multi Quiz Complete Lesson ${randomUUID()}`,
      });

      const activities = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "MQ1",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "MQ2",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: "MQ3",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 4,
          title: "MQ4",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          position: 5,
          title: `Multi Quiz 1 ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          position: 6,
          title: `Multi Quiz 2 ${randomUUID()}`,
        }),
      ]);

      const quiz1 = activities[4];
      const quiz2 = activities[5];

      await activityGenerationWorkflow(testLesson.id);

      const [dbQuiz1, dbQuiz2] = await Promise.all([
        prisma.activity.findUnique({ where: { id: quiz1?.id } }),
        prisma.activity.findUnique({ where: { id: quiz2?.id } }),
      ]);

      expect(dbQuiz1?.generationStatus).toBe("completed");
      expect(dbQuiz2?.generationStatus).toBe("completed");
    });

    test("sets explanation to 'failed' when generateActivityExplanation rejects for one of multiple explanations", async () => {
      const failConcept = `Exp Fail ${randomUUID()}`;

      vi.mocked(generateActivityExplanation).mockImplementation(async (params) => {
        if (params.concept === failConcept) {
          throw new Error("AI generation failed");
        }
        return {
          data: {
            steps: [{ text: "Step text", title: "Step Title" }],
          },
          systemPrompt: "test",
          usage: {} as Awaited<ReturnType<typeof generateActivityExplanation>>["usage"],
          userPrompt: "test",
        };
      });

      const okConcept1 = `Exp OK 1 ${randomUUID()}`;
      const okConcept2 = `Exp OK 2 ${randomUUID()}`;

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: [okConcept1, failConcept, okConcept2],
        organizationId,
        title: `Partial Exp Fail Lesson ${randomUUID()}`,
      });

      const [expA, expB, expC] = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: okConcept1,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: failConcept,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: okConcept2,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      const [dbA, dbB, dbC] = await Promise.all([
        prisma.activity.findUnique({ where: { id: expA.id } }),
        prisma.activity.findUnique({ where: { id: expB.id } }),
        prisma.activity.findUnique({ where: { id: expC.id } }),
      ]);

      expect(dbA?.generationStatus).toBe("completed");
      expect(dbB?.generationStatus).toBe("failed");
      expect(dbC?.generationStatus).toBe("completed");

      const streamedMessages = getStreamedMessages();

      expect(streamedMessages).toContainEqual({
        status: "error",
        step: "generateExplanationContent",
      });

      expect(streamedMessages).not.toContainEqual({
        status: "completed",
        step: "generateExplanationContent",
      });

      // Completion step should still succeed (A and C updated, B skipped as "failed")
      expect(streamedMessages).toContainEqual({
        status: "completed",
        step: "setExplanationAsCompleted",
      });
    });

    test("streams error when activity completion DB update fails", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["DB Fail Concept"],
        organizationId,
        title: `Complete DB Fail Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: "DB Fail Concept",
      });

      // Add a CHECK constraint that prevents this specific activity from being set to "completed"
      await prisma.$executeRawUnsafe(
        `ALTER TABLE activities ADD CONSTRAINT prevent_completion_test CHECK (NOT (id = ${String(activity.id)} AND generation_status = 'completed'))`,
      );

      try {
        await activityGenerationWorkflow(testLesson.id);

        const dbActivity = await prisma.activity.findUnique({
          where: { id: activity.id },
        });

        expect(dbActivity?.generationStatus).toBe("failed");

        const streamedMessages = getStreamedMessages();

        expect(streamedMessages).toContainEqual({
          status: "error",
          step: "setExplanationAsCompleted",
        });

        expect(streamedMessages).not.toContainEqual({
          status: "completed",
          step: "setExplanationAsCompleted",
        });
      } finally {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE activities DROP CONSTRAINT IF EXISTS prevent_completion_test`,
        );
      }
    });
  });

  describe("neighboring concepts", () => {
    test("passes neighboring concepts to all wave 1 generation steps", async () => {
      vi.mocked(getNeighboringConceptsStep).mockResolvedValueOnce(["Neighbor A"]);

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Main Concept"],
        organizationId,
        title: `Neighboring Concepts Lesson ${randomUUID()}`,
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
          title: "Main Concept",
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
        activityFixture({
          generationStatus: "pending",
          kind: "challenge",
          lessonId: testLesson.id,
          organizationId,
          title: `Challenge ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).toHaveBeenCalledWith(
        expect.objectContaining({ neighboringConcepts: ["Neighbor A"] }),
      );
      expect(generateActivityExplanation).toHaveBeenCalledWith(
        expect.objectContaining({ neighboringConcepts: ["Neighbor A"] }),
      );
      expect(generateActivityMechanics).toHaveBeenCalledWith(
        expect.objectContaining({ neighboringConcepts: ["Neighbor A"] }),
      );
      expect(generateActivityExamples).toHaveBeenCalledWith(
        expect.objectContaining({ neighboringConcepts: ["Neighbor A"] }),
      );
      expect(generateActivityStory).toHaveBeenCalledWith(
        expect.objectContaining({ neighboringConcepts: ["Neighbor A"] }),
      );
      expect(generateActivityChallenge).toHaveBeenCalledWith(
        expect.objectContaining({ neighboringConcepts: ["Neighbor A"] }),
      );
    });
  });
});
