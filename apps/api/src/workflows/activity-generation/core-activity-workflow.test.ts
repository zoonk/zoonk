import { randomUUID } from "node:crypto";
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
import { getString } from "@zoonk/utils/json";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { activityGenerationWorkflow } from "./activity-generation-workflow";
import { getNeighboringConceptsStep } from "./steps/get-neighboring-concepts-step";

vi.mock("./steps/get-neighboring-concepts-step", () => ({
  getNeighboringConceptsStep: vi.fn().mockResolvedValue([]),
}));

const mockStreamWrite = vi.hoisted(() => vi.fn().mockResolvedValue(null));

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
      write: mockStreamWrite,
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
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

      const explanationActivity = await activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Completed Exp ${randomUUID()}`,
      });

      await stepFixture({
        activityId: explanationActivity.id,
        content: {
          text: "Existing explanation text",
          title: "Existing Explanation",
          variant: "text",
        },
        position: 0,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanation).not.toHaveBeenCalled();
    });

    test("skips explanation when completed and still generates quiz", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Resume Exp For Quiz Lesson ${randomUUID()}`,
      });

      const explanationActivity = await activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Completed Exp ${randomUUID()}`,
      });

      await stepFixture({
        activityId: explanationActivity.id,
        content: { text: "Existing Exp text", title: "Existing Exp", variant: "text" },
        position: 0,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "quiz",
        lessonId: testLesson.id,
        organizationId,
        title: `Pending Quiz ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanation).not.toHaveBeenCalled();
      expect(generateActivityQuiz).toHaveBeenCalled();
    });

    test("skips visuals if ALL DB steps already have visual data", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Resume Visuals Lesson ${randomUUID()}`,
      });

      const explanationActivity = await activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Exp With Visuals ${randomUUID()}`,
      });

      await Promise.all([
        stepFixture({
          activityId: explanationActivity.id,
          content: { text: "Step text", title: "Step", variant: "text" },
          position: 0,
        }),
        stepFixture({
          activityId: explanationActivity.id,
          content: { kind: "image", prompt: "A prompt", url: "https://example.com/existing.webp" },
          kind: "visual",
          position: 1,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanation).not.toHaveBeenCalled();
      expect(generateStepVisuals).not.toHaveBeenCalled();
    });

    test("skips images if ALL image steps already have URLs", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Resume Images Lesson ${randomUUID()}`,
      });

      const explanationActivity = await activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Exp With Images ${randomUUID()}`,
      });

      await Promise.all([
        stepFixture({
          activityId: explanationActivity.id,
          content: { text: "Step text", title: "Step", variant: "text" },
          position: 0,
        }),
        stepFixture({
          activityId: explanationActivity.id,
          content: { kind: "image", prompt: "A prompt", url: "https://example.com/existing.webp" },
          kind: "visual",
          position: 1,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateVisualStepImage).not.toHaveBeenCalled();
    });

    test("skips quiz content if quiz steps already exist in DB", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Resume Quiz Lesson ${randomUUID()}`,
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

    test("re-runs failed quiz when explanation has steps", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Retry Failed Quiz Lesson ${randomUUID()}`,
      });

      const explanationActivity = await activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Exp for Failed Quiz ${randomUUID()}`,
      });

      await stepFixture({
        activityId: explanationActivity.id,
        content: { text: "Explanation content", title: "Explanation", variant: "text" },
        position: 0,
      });

      await activityFixture({
        generationStatus: "failed",
        kind: "quiz",
        lessonId: testLesson.id,
        organizationId,
        title: `Failed Quiz Retry ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanation).not.toHaveBeenCalled();
      expect(generateActivityQuiz).toHaveBeenCalled();
    });

    test("partial failure: explanation completed + quiz failed → re-trigger only runs quiz", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Partial Retry Lesson ${randomUUID()}`,
      });

      const explanationActivity = await activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Completed Exp Partial ${randomUUID()}`,
      });

      await stepFixture({
        activityId: explanationActivity.id,
        content: {
          text: "Explanation for partial",
          title: "Partial Exp",
          variant: "text",
        },
        position: 0,
      });

      const quizActivity = await activityFixture({
        generationStatus: "failed",
        kind: "quiz",
        lessonId: testLesson.id,
        organizationId,
        title: `Failed Quiz Partial ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanation).not.toHaveBeenCalled();
      expect(generateActivityQuiz).toHaveBeenCalled();

      const dbActivity = await prisma.activity.findUnique({
        where: { id: quizActivity.id },
      });
      expect(dbActivity?.generationStatus).toBe("completed");
    });

    test("partial completion: explanation completed + quiz pending + practice pending works correctly", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Partial Complete Lesson ${randomUUID()}`,
      });

      const explanationActivity = await activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Partial Complete Exp ${randomUUID()}`,
      });

      await stepFixture({
        activityId: explanationActivity.id,
        content: {
          text: "Partial complete Exp text",
          title: "Partial Exp",
          variant: "text",
        },
        position: 0,
      });

      const quizActivity = await activityFixture({
        generationStatus: "pending",
        kind: "quiz",
        lessonId: testLesson.id,
        organizationId,
        title: `Partial Complete Quiz ${randomUUID()}`,
      });

      const practiceActivity = await activityFixture({
        generationStatus: "pending",
        kind: "practice",
        lessonId: testLesson.id,
        organizationId,
        title: `Partial Complete Practice ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanation).not.toHaveBeenCalled();
      expect(generateActivityQuiz).toHaveBeenCalled();
      expect(generateActivityPractice).toHaveBeenCalled();

      const [dbQuiz, dbPractice] = await Promise.all([
        prisma.activity.findUnique({ where: { id: quizActivity.id } }),
        prisma.activity.findUnique({ where: { id: practiceActivity.id } }),
      ]);

      expect(dbQuiz?.generationStatus).toBe("completed");
      expect(dbPractice?.generationStatus).toBe("completed");
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
    test("practice failure does not affect explanation completion", async () => {
      vi.mocked(generateActivityPractice).mockRejectedValueOnce(new Error("Practice failed"));

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `Isolation Lesson ${randomUUID()}`,
      });

      const [expActivity, practiceActivity] = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Explanation ${randomUUID()}`,
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

      const [dbExp, dbPractice] = await Promise.all([
        prisma.activity.findUnique({ where: { id: expActivity.id } }),
        prisma.activity.findUnique({ where: { id: practiceActivity.id } }),
      ]);

      expect(dbExp?.generationStatus).toBe("completed");
      expect(dbPractice?.generationStatus).toBe("failed");
    });
  });

  describe("full pipeline", () => {
    test("generates all 3 activities end to end", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Test Concept"],
        organizationId,
        title: `Full Pipeline Lesson ${randomUUID()}`,
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

      expect(dbExp?.generationStatus).toBe("completed");
      expect(dbQuiz?.generationStatus).toBe("completed");
      expect(dbPractice?.generationStatus).toBe("completed");

      expect(generateActivityExplanation).toHaveBeenCalledOnce();
      expect(generateActivityQuiz).toHaveBeenCalledOnce();
      expect(generateActivityPractice).toHaveBeenCalledOnce();

      const [expSteps, quizSteps, practiceSteps] = await Promise.all([
        prisma.step.findMany({ where: { activityId: expActivity.id } }),
        prisma.step.findMany({ where: { activityId: quizActivity.id } }),
        prisma.step.findMany({ where: { activityId: practiceActivity.id } }),
      ]);

      expect(expSteps.length).toBeGreaterThan(0);
      expect(quizSteps.length).toBeGreaterThan(0);
      expect(practiceSteps.length).toBeGreaterThan(0);

      for (const steps of [expSteps]) {
        const imageSteps = steps.filter(
          (step) => step.kind === "visual" && getString(step.content, "kind") === "image",
        );
        expect(imageSteps.length).toBeGreaterThan(0);

        for (const step of imageSteps) {
          expect(step.content).toEqual(expect.objectContaining({ url: expect.any(String) }));
        }
      }
    });
  });

  describe("partial explanation retry", () => {
    test("practice gets correct explanation data when some explanations were already completed", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["CompletedExp", "PendingExp"],
        organizationId,
        title: `Partial Exp Retry Lesson ${randomUUID()}`,
      });

      // Explanation 1: completed with existing steps in DB
      const completedExpActivity = await activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        position: 1,
        title: "CompletedExp",
      });

      await stepFixture({
        activityId: completedExpActivity.id,
        content: {
          text: "Completed explanation text",
          title: "CompletedExp",
          variant: "text",
        },
        position: 0,
      });

      // Explanation 2: pending (needs generation)
      await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        position: 2,
        title: "PendingExp",
      });

      // Practice: pending
      const practiceActivity = await activityFixture({
        generationStatus: "pending",
        kind: "practice",
        lessonId: testLesson.id,
        organizationId,
        position: 3,
        title: `Practice ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      // The mock returns "Explanation step 1 text" / "Explanation Step 1" for the pending one
      // The completed one provides "Completed explanation text" / "CompletedExp"
      // Practice should get explanation steps from BOTH sources

      expect(generateActivityExplanation).toHaveBeenCalledOnce();
      expect(generateActivityPractice).toHaveBeenCalledOnce();

      // Verify practice got explanation steps from both completed and generated explanations
      expect(generateActivityPractice).toHaveBeenCalledWith(
        expect.objectContaining({
          explanationSteps: expect.arrayContaining([
            { text: "Completed explanation text", title: "CompletedExp" },
            { text: "Explanation step 1 text", title: "Explanation Step 1" },
            { text: "Explanation step 2 text", title: "Explanation Step 2" },
          ]),
        }),
      );

      const dbPractice = await prisma.activity.findUnique({
        where: { id: practiceActivity.id },
      });
      expect(dbPractice?.generationStatus).toBe("completed");
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
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: "Main Concept",
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

      expect(generateActivityExplanation).toHaveBeenCalledWith(
        expect.objectContaining({ neighboringConcepts: ["Neighbor A"] }),
      );
    });
  });
});
