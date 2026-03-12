import { randomUUID } from "node:crypto";
import { generateActivityBackground } from "@zoonk/ai/tasks/activities/core/background";
import { generateActivityChallenge } from "@zoonk/ai/tasks/activities/core/challenge";
import { generateActivityExamples } from "@zoonk/ai/tasks/activities/core/examples";
import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { generateActivityPractice } from "@zoonk/ai/tasks/activities/core/practice";
import { generateActivityQuiz } from "@zoonk/ai/tasks/activities/core/quiz";
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

vi.mock("@zoonk/ai/tasks/activities/core/practice", () => ({
  generateActivityPractice: vi.fn().mockResolvedValue({
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
    test("explanation returns empty → quiz and practice marked as failed (both depend on explanation)", async () => {
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

      const [expActivity, quizActivity, practiceActivity] = await Promise.all([
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
        activityFixture({
          generationStatus: "pending",
          kind: "practice",
          lessonId: testLesson.id,
          organizationId,
          title: `Practice ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      const [dbExp, dbQuiz, dbPractice] = await Promise.all([
        prisma.activity.findUnique({ where: { id: expActivity.id } }),
        prisma.activity.findUnique({ where: { id: quizActivity.id } }),
        prisma.activity.findUnique({ where: { id: practiceActivity.id } }),
      ]);

      expect(dbExp?.generationStatus).toBe("failed");
      expect(dbQuiz?.generationStatus).toBe("failed");
      expect(dbPractice?.generationStatus).toBe("failed");

      expect(generateActivityQuiz).not.toHaveBeenCalled();
      expect(generateActivityPractice).not.toHaveBeenCalled();
    });

    test("empty concepts → examples and challenge marked as failed", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: [],
        organizationId,
        title: `Empty Concepts Cascade Lesson ${randomUUID()}`,
      });

      const [examplesActivity, challengeActivity] = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "examples",
          lessonId: testLesson.id,
          organizationId,
          title: `Examples ${randomUUID()}`,
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

      const [dbExamples, dbChallenge] = await Promise.all([
        prisma.activity.findUnique({ where: { id: examplesActivity.id } }),
        prisma.activity.findUnique({ where: { id: challengeActivity.id } }),
      ]);

      expect(dbExamples?.generationStatus).toBe("failed");
      expect(dbChallenge?.generationStatus).toBe("failed");

      expect(generateActivityExamples).not.toHaveBeenCalled();
      expect(generateActivityChallenge).not.toHaveBeenCalled();
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
    test("generates all 6 activities end to end", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `Full Pipeline Lesson ${randomUUID()}`,
      });

      const [
        bgActivity,
        expActivity,
        quizActivity,
        examplesActivity,
        practiceActivity,
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
          kind: "practice",
          lessonId: testLesson.id,
          organizationId,
          title: `Practice ${randomUUID()}`,
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

      const [dbBg, dbExp, dbQuiz, dbExamples, dbPractice, dbChallenge] = await Promise.all([
        prisma.activity.findUnique({ where: { id: bgActivity.id } }),
        prisma.activity.findUnique({ where: { id: expActivity.id } }),
        prisma.activity.findUnique({ where: { id: quizActivity.id } }),
        prisma.activity.findUnique({ where: { id: examplesActivity.id } }),
        prisma.activity.findUnique({ where: { id: practiceActivity.id } }),
        prisma.activity.findUnique({ where: { id: challengeActivity.id } }),
      ]);

      expect(dbBg?.generationStatus).toBe("completed");
      expect(dbExp?.generationStatus).toBe("completed");
      expect(dbQuiz?.generationStatus).toBe("completed");
      expect(dbExamples?.generationStatus).toBe("completed");
      expect(dbPractice?.generationStatus).toBe("completed");
      expect(dbChallenge?.generationStatus).toBe("completed");

      expect(generateActivityBackground).toHaveBeenCalledOnce();
      expect(generateActivityExplanation).toHaveBeenCalledOnce();
      expect(generateActivityQuiz).toHaveBeenCalledOnce();
      expect(generateActivityExamples).toHaveBeenCalledOnce();
      expect(generateActivityPractice).toHaveBeenCalledOnce();
      expect(generateActivityChallenge).toHaveBeenCalledOnce();

      const [bgSteps, expSteps, quizSteps, examplesSteps, practiceSteps, challengeSteps] =
        await Promise.all([
          prisma.step.findMany({ where: { activityId: bgActivity.id } }),
          prisma.step.findMany({ where: { activityId: expActivity.id } }),
          prisma.step.findMany({ where: { activityId: quizActivity.id } }),
          prisma.step.findMany({ where: { activityId: examplesActivity.id } }),
          prisma.step.findMany({ where: { activityId: practiceActivity.id } }),
          prisma.step.findMany({ where: { activityId: challengeActivity.id } }),
        ]);

      expect(bgSteps.length).toBeGreaterThan(0);
      expect(expSteps.length).toBeGreaterThan(0);
      expect(quizSteps.length).toBeGreaterThan(0);
      expect(examplesSteps.length).toBeGreaterThan(0);
      expect(practiceSteps.length).toBeGreaterThan(0);
      expect(challengeSteps.length).toBeGreaterThan(0);

      for (const steps of [bgSteps, expSteps, examplesSteps]) {
        const imageSteps = steps.filter((step) => step.visualKind === "image");
        expect(imageSteps.length).toBeGreaterThan(0);

        for (const step of imageSteps) {
          expect(step.visualContent).toEqual(expect.objectContaining({ url: expect.any(String) }));
        }
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
          kind: "examples",
          lessonId: testLesson.id,
          organizationId,
          title: `Examples ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "practice",
          lessonId: testLesson.id,
          organizationId,
          title: `Practice ${randomUUID()}`,
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
      expect(generateActivityExamples).toHaveBeenCalledWith(
        expect.objectContaining({ neighboringConcepts: ["Neighbor A"] }),
      );
      expect(generateActivityChallenge).toHaveBeenCalledWith(
        expect.objectContaining({ neighboringConcepts: ["Neighbor A"] }),
      );
    });
  });
});
