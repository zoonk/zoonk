import { randomUUID } from "node:crypto";
import { generateActivityQuiz } from "@zoonk/ai/tasks/activities/core/quiz";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { type ExplanationResult } from "../steps/generate-explanation-content-step";
import { getLessonActivitiesStep } from "../steps/get-lesson-activities-step";
import { quizActivityWorkflow } from "./quiz-workflow";

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

vi.mock("@zoonk/core/steps/image", () => ({
  generateStepImage: vi.fn().mockResolvedValue({
    data: "https://example.com/quiz-image.webp",
    error: null,
  }),
}));

function buildExplanationResults(activityId: string): ExplanationResult[] {
  return [
    {
      activityId,
      concept: "Test Concept",
      steps: [
        { text: "Explanation step 1", title: "Step 1" },
        { text: "Explanation step 2", title: "Step 2" },
      ],
    },
  ];
}

describe("quiz activity workflow", () => {
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
      title: `Quiz WF Chapter ${randomUUID()}`,
    });
  });

  test("creates quiz steps from explanation results", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Quiz Content Lesson ${randomUUID()}`,
    });

    const [explanationActivity, quizActivity] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: "Test Concept",
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "quiz",
        lessonId: testLesson.id,
        organizationId,
        title: `Quiz ${randomUUID()}`,
      }),
    ]);

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
    const explanationResults = buildExplanationResults(explanationActivity.id);

    await quizActivityWorkflow({
      activitiesToGenerate: activities,
      explanationResults,
      workflowRunId: "test-run-id",
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: quizActivity.id },
    });

    expect(steps).toHaveLength(2);

    for (const step of steps) {
      expect(step.isPublished).toBe(true);
    }

    expect(steps[0]?.kind).toBe("multipleChoice");
    expect(steps[1]?.kind).toBe("selectImage");
  });

  test("sets quiz status to 'completed' after saving", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Quiz Completed Lesson ${randomUUID()}`,
    });

    const [explanationActivity, quizActivity] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: "Test Concept",
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "quiz",
        lessonId: testLesson.id,
        organizationId,
        title: `Quiz ${randomUUID()}`,
      }),
    ]);

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
    const explanationResults = buildExplanationResults(explanationActivity.id);

    await quizActivityWorkflow({
      activitiesToGenerate: activities,
      explanationResults,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({
      where: { id: quizActivity.id },
    });
    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
  });

  test("sets quiz status to 'failed' when AI throws", async () => {
    vi.mocked(generateActivityQuiz).mockRejectedValueOnce(new Error("Quiz generation failed"));

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Quiz Failed Lesson ${randomUUID()}`,
    });

    const [explanationActivity, quizActivity] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: "Test Concept",
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "quiz",
        lessonId: testLesson.id,
        organizationId,
        title: `Quiz ${randomUUID()}`,
      }),
    ]);

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
    const explanationResults = buildExplanationResults(explanationActivity.id);

    await expect(
      quizActivityWorkflow({
        activitiesToGenerate: activities,
        explanationResults,
        workflowRunId: "test-run-id",
      }),
    ).rejects.toThrow("Quiz generation failed");

    const dbActivity = await prisma.activity.findUnique({
      where: { id: quizActivity.id },
    });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("sets quiz status to 'failed' when explanation steps are empty", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Quiz Empty Exp Lesson ${randomUUID()}`,
    });

    const quizActivity = await activityFixture({
      generationStatus: "pending",
      kind: "quiz",
      lessonId: testLesson.id,
      organizationId,
      title: `Quiz ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });

    await expect(
      quizActivityWorkflow({
        activitiesToGenerate: activities,
        explanationResults: [],
        workflowRunId: "test-run-id",
      }),
    ).rejects.toThrow("Quiz generation needs explanation steps");

    const dbActivity = await prisma.activity.findUnique({
      where: { id: quizActivity.id },
    });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("creates quiz image URLs for selectImage options", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Quiz Images Lesson ${randomUUID()}`,
    });

    const [explanationActivity, quizActivity] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: "Test Concept",
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "quiz",
        lessonId: testLesson.id,
        organizationId,
        title: `Quiz ${randomUUID()}`,
      }),
    ]);

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
    const explanationResults = buildExplanationResults(explanationActivity.id);

    await quizActivityWorkflow({
      activitiesToGenerate: activities,
      explanationResults,
      workflowRunId: "test-run-id",
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: quizActivity.id },
    });

    const selectImageStep = steps.find((step) => step.kind === "selectImage");
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test assertion on Prisma JSON field
    const content = selectImageStep?.content as { options: { url?: string }[] };

    expect(content.options[0]?.url).toBe("https://example.com/quiz-image.webp");
    expect(content.options[1]?.url).toBe("https://example.com/quiz-image.webp");
  });

  test("skips if already completed", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Quiz Skip Lesson ${randomUUID()}`,
    });

    const [explanationActivity, quizActivity] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: "Test Concept",
      }),
      activityFixture({
        generationStatus: "completed",
        kind: "quiz",
        lessonId: testLesson.id,
        organizationId,
        title: `Quiz ${randomUUID()}`,
      }),
    ]);

    await stepFixture({
      activityId: quizActivity.id,
      content: {
        context: "Existing context",
        kind: "core",
        options: [{ feedback: "Yes", isCorrect: true, text: "A" }],
        question: "Existing?",
      },
      kind: "multipleChoice",
      position: 0,
    });

    const explanationResults = buildExplanationResults(explanationActivity.id);

    await quizActivityWorkflow({
      activitiesToGenerate: [],
      explanationResults,
      workflowRunId: "test-run-id",
    });

    expect(generateActivityQuiz).not.toHaveBeenCalled();
  });
});
