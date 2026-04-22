import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { generateActivityCustom } from "@zoonk/ai/tasks/activities/custom";
import { type generateStepImagePrompts } from "@zoonk/ai/tasks/steps/image-prompts";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { activityGenerationWorkflow } from "./activity-generation-workflow";
import { type generateStepImages } from "./steps/_utils/generate-step-images";

function createPromptResult(
  steps: { title: string; text: string }[],
): Awaited<ReturnType<typeof generateStepImagePrompts>> {
  return {
    data: {
      prompts: steps.map((step) => `A lesson illustration for ${step.title}`),
    },
    systemPrompt: "test",
    usage: {} as Awaited<ReturnType<typeof generateStepImagePrompts>>["usage"],
    userPrompt: "test",
  };
}

function createImageResult(prompts: string[]): Awaited<ReturnType<typeof generateStepImages>> {
  return prompts.map((prompt, index) => ({
    prompt,
    url: `https://example.com/step-image-${index}.webp`,
  }));
}

function createExplanationResult(): Awaited<ReturnType<typeof generateActivityExplanation>> {
  return {
    data: {
      anchor: {
        text: "Every photo you send on WhatsApp uses this exact layering — you hit send, it runs.",
        title: "Every send",
      },
      explanation: [
        {
          text: "You send a photo on WhatsApp. In under a second, it appears on your friend's screen, even if you're on the bus.",
          title: "O envio",
        },
        {
          text: "Between the tap and the delivered photo, the message passes through several hidden points. Each one wraps it with a different kind of label.",
          title: "Os rótulos escondidos",
        },
        {
          text: "Here are the wrappers, in the order they get added: the app wrapper, the transport wrapper, the network wrapper. Each layer adds a label for a different job.",
          title: "A pilha",
        },
        {
          text: "Zoom in on the network wrapper: it only carries routing info — where to send next. The chat content stays sealed inside, untouched by routers.",
          title: "O rótulo de rede",
        },
      ],
    },
    systemPrompt: "test",
    usage: {} as Awaited<ReturnType<typeof generateActivityExplanation>>["usage"],
    userPrompt: "test",
  };
}

vi.mock("@zoonk/ai/tasks/activities/core/explanation", () => ({
  generateActivityExplanation: vi.fn().mockResolvedValue(createExplanationResult()),
}));

vi.mock("@zoonk/ai/tasks/steps/image-prompts", () => ({
  generateStepImagePrompts: vi
    .fn()
    .mockImplementation(({ steps }: { steps: { title: string; text: string }[] }) =>
      Promise.resolve(createPromptResult(steps)),
    ),
}));

vi.mock("./steps/_utils/generate-step-images", () => ({
  generateStepImages: vi
    .fn()
    .mockImplementation(({ prompts }: { prompts: string[] }) =>
      Promise.resolve(createImageResult(prompts)),
    ),
}));

vi.mock("@zoonk/ai/tasks/activities/core/practice", () => ({
  generateActivityPractice: vi.fn().mockResolvedValue({
    data: {
      scenario: {
        text: "I'm closing the support queue with Maya, and one customer report still does not line up with the refund totals.",
        title: "Night shift",
      },
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
      title: "The game store signup mix-up",
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

describe(activityGenerationWorkflow, () => {
  let organizationId: string;
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

      expect(generateActivityExplanation).not.toHaveBeenCalled();
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
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Explanation ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanation).toHaveBeenCalledOnce();
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
      expect(generateActivityExplanation).not.toHaveBeenCalled();
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
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Explanation ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanation).not.toHaveBeenCalled();
      expect(generateActivityCustom).not.toHaveBeenCalled();
    });

    test("regenerates only the hidden replacement activities", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        kind: "core",
        organizationId,
        title: `Hidden Regen Lesson ${randomUUID()}`,
      });

      const [publishedActivity, replacementActivity, archivedReplacementActivity] =
        await Promise.all([
          activityFixture({
            generationStatus: "completed",
            isPublished: true,
            kind: "explanation",
            lessonId: testLesson.id,
            organizationId,
            position: 0,
            title: `Published ${randomUUID()}`,
          }),
          activityFixture({
            generationRunId: "regen-run-1",
            generationStatus: "pending",
            isPublished: false,
            kind: "explanation",
            lessonId: testLesson.id,
            organizationId,
            position: 1,
            title: `Replacement ${randomUUID()}`,
          }),
          activityFixture({
            archivedAt: new Date(),
            generationRunId: "old-regen-run",
            generationStatus: "pending",
            isPublished: false,
            kind: "explanation",
            lessonId: testLesson.id,
            organizationId,
            position: 2,
            title: `Archived Replacement ${randomUUID()}`,
          }),
        ]);

      await activityGenerationWorkflow(testLesson.id, { regeneration: true });

      const [
        updatedPublishedActivity,
        updatedReplacementActivity,
        updatedArchivedReplacementActivity,
      ] = await Promise.all([
        prisma.activity.findUniqueOrThrow({ where: { id: publishedActivity.id } }),
        prisma.activity.findUniqueOrThrow({ where: { id: replacementActivity.id } }),
        prisma.activity.findUniqueOrThrow({ where: { id: archivedReplacementActivity.id } }),
      ]);

      expect(generateActivityExplanation).toHaveBeenCalledOnce();
      expect(updatedPublishedActivity.generationStatus).toBe("completed");
      expect(updatedReplacementActivity.generationStatus).toBe("completed");
      expect(updatedReplacementActivity.isPublished).toBe(false);
      expect(updatedArchivedReplacementActivity.generationStatus).toBe("pending");
      expect(updatedArchivedReplacementActivity.archivedAt).not.toBeNull();
    });

    test("streams completion events when all activities are completed", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        kind: "core",
        organizationId,
        title: `All Completed Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 0,
          title: `Completed Explanation ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: `Completed Quiz ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanation).not.toHaveBeenCalled();
      expect(generateActivityCustom).not.toHaveBeenCalled();

      const completionEvent = getStreamedEvents().find(
        (event) => event.step === "saveExplanationActivity" && event.status === "completed",
      );
      expect(completionEvent).toBeDefined();
    });

    test("returns early without streaming completion when activities are completed or running", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        kind: "core",
        organizationId,
        title: `Mixed Done Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Completed ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "running",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          title: `Running ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanation).not.toHaveBeenCalled();
      expect(generateActivityCustom).not.toHaveBeenCalled();

      const completionEvent = getStreamedEvents().find(
        (event) => event.step === "saveExplanationActivity" && event.status === "completed",
      );
      expect(completionEvent).toBeUndefined();
    });

    test("does not skip when some activities are pending", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        kind: "core",
        organizationId,
        title: `Has Pending Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "completed",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          title: `Completed ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Pending ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanation).toHaveBeenCalled();
    });

    test("does not skip when some activities are failed", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        kind: "core",
        organizationId,
        title: `Has Failed Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "completed",
          kind: "quiz",
          lessonId: testLesson.id,
          organizationId,
          title: `Completed ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "failed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          title: `Failed ${randomUUID()}`,
        }),
      ]);

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityExplanation).toHaveBeenCalled();
    });
  });

  describe("workflow failure handling", () => {
    test("marks running published activities as failed and re-throws on workflow crash", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Failure Handling Lesson ${randomUUID()}`,
      });

      const runningActivity = await activityFixture({
        generationRunId: "test-run-id",
        generationStatus: "running",
        isPublished: true,
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Running Activity ${randomUUID()}`,
      });

      const completedActivity = await activityFixture({
        generationRunId: "test-run-id",
        generationStatus: "completed",
        isPublished: true,
        kind: "quiz",
        lessonId: testLesson.id,
        organizationId,
        title: `Completed Activity ${randomUUID()}`,
      });

      const pendingActivity = await activityFixture({
        generationStatus: "pending",
        kind: "practice",
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
      expect(running?.generationRunId).toBe("test-run-id");
    });
  });
});
