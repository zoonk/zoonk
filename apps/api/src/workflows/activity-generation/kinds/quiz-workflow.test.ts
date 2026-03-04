import { randomUUID } from "node:crypto";
import { generateActivityQuiz } from "@zoonk/ai/tasks/activities/core/quiz";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { type ExplanationResult } from "../steps/generate-explanation-content-step";
import { getLessonActivitiesStep } from "../steps/get-lesson-activities-step";
import { quizActivityWorkflow } from "./quiz-workflow";

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

function buildExplanationResults(activityId: number): ExplanationResult[] {
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
      title: `Quiz WF Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
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

    const activities = await getLessonActivitiesStep(testLesson.id);
    const explanationResults = buildExplanationResults(Number(explanationActivity.id));

    await quizActivityWorkflow(activities, "test-run-id", explanationResults, 1);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: quizActivity.id },
    });

    expect(steps).toHaveLength(2);

    for (const step of steps) {
      expect(step.isPublished).toBeTruthy();
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

    const activities = await getLessonActivitiesStep(testLesson.id);
    const explanationResults = buildExplanationResults(Number(explanationActivity.id));

    await quizActivityWorkflow(activities, "test-run-id", explanationResults, 1);

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

    const activities = await getLessonActivitiesStep(testLesson.id);
    const explanationResults = buildExplanationResults(Number(explanationActivity.id));

    await quizActivityWorkflow(activities, "test-run-id", explanationResults, 1);

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

    const activities = await getLessonActivitiesStep(testLesson.id);

    await quizActivityWorkflow(activities, "test-run-id", [], 1);

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

    const activities = await getLessonActivitiesStep(testLesson.id);
    const explanationResults = buildExplanationResults(Number(explanationActivity.id));

    await quizActivityWorkflow(activities, "test-run-id", explanationResults, 1);

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

    const activities = await getLessonActivitiesStep(testLesson.id);
    const explanationResults = buildExplanationResults(Number(explanationActivity.id));

    await quizActivityWorkflow(activities, "test-run-id", explanationResults, 1);

    expect(generateActivityQuiz).not.toHaveBeenCalled();
  });

  describe("multi-quiz behavior", () => {
    test("creates two quizzes when lesson has 4+ concepts", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Q1", "Q2", "Q3", "Q4"],
        organizationId,
        title: `Two Quiz Lesson ${randomUUID()}`,
      });

      const [expQ1, expQ2, expQ3, expQ4] = await Promise.all([
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Q1",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Q2",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: "Q3",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 4,
          title: "Q4",
        }),
      ]);

      await Promise.all([
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

      const activities = await getLessonActivitiesStep(testLesson.id);
      const explanationResults: ExplanationResult[] = [
        { activityId: Number(expQ1.id), concept: "Q1", steps: [{ text: "Q1 text", title: "Q1" }] },
        { activityId: Number(expQ2.id), concept: "Q2", steps: [{ text: "Q2 text", title: "Q2" }] },
        { activityId: Number(expQ3.id), concept: "Q3", steps: [{ text: "Q3 text", title: "Q3" }] },
        { activityId: Number(expQ4.id), concept: "Q4", steps: [{ text: "Q4 text", title: "Q4" }] },
      ];

      await quizActivityWorkflow(activities, "test-run-id", explanationResults, 2);

      expect(generateActivityQuiz).toHaveBeenCalledTimes(2);
    });

    test("quiz 1 gets first half of explanation steps, quiz 2 gets second half", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Half1A", "Half1B", "Half2A", "Half2B"],
        organizationId,
        title: `Quiz Split Lesson ${randomUUID()}`,
      });

      const [expH1A, expH1B, expH2A, expH2B] = await Promise.all([
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Half1A",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Half1B",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: "Half2A",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 4,
          title: "Half2B",
        }),
      ]);

      await Promise.all([
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

      const activities = await getLessonActivitiesStep(testLesson.id);
      const explanationResults: ExplanationResult[] = [
        {
          activityId: Number(expH1A.id),
          concept: "Half1A",
          steps: [{ text: "H1A text", title: "H1A" }],
        },
        {
          activityId: Number(expH1B.id),
          concept: "Half1B",
          steps: [{ text: "H1B text", title: "H1B" }],
        },
        {
          activityId: Number(expH2A.id),
          concept: "Half2A",
          steps: [{ text: "H2A text", title: "H2A" }],
        },
        {
          activityId: Number(expH2B.id),
          concept: "Half2B",
          steps: [{ text: "H2B text", title: "H2B" }],
        },
      ];

      await quizActivityWorkflow(activities, "test-run-id", explanationResults, 2);

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

      const [expSA, expSB] = await Promise.all([
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Single A",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Single B",
        }),
      ]);

      await activityFixture({
        generationStatus: "pending",
        kind: "quiz",
        lessonId: testLesson.id,
        organizationId,
        position: 3,
        title: `Single Quiz ${randomUUID()}`,
      });

      const activities = await getLessonActivitiesStep(testLesson.id);
      const explanationResults: ExplanationResult[] = [
        {
          activityId: Number(expSA.id),
          concept: "Single A",
          steps: [{ text: "SA text", title: "SA" }],
        },
        {
          activityId: Number(expSB.id),
          concept: "Single B",
          steps: [{ text: "SB text", title: "SB" }],
        },
      ];

      await quizActivityWorkflow(activities, "test-run-id", explanationResults, 1);

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

      const expOnly = await activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        position: 1,
        title: "OnlyConcept",
      });

      await Promise.all([
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

      const activities = await getLessonActivitiesStep(testLesson.id);
      const explanationResults: ExplanationResult[] = [
        {
          activityId: Number(expOnly.id),
          concept: "OnlyConcept",
          steps: [{ text: "Only text", title: "Only" }],
        },
      ];

      await quizActivityWorkflow(activities, "test-run-id", explanationResults, 2);

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

      const [expQC1, expQC2, expQC3, expQC4] = await Promise.all([
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "QC1",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "QC2",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: "QC3",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 4,
          title: "QC4",
        }),
      ]);

      const [quiz1, quiz2] = await Promise.all([
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

      const activities = await getLessonActivitiesStep(testLesson.id);
      const explanationResults: ExplanationResult[] = [
        {
          activityId: Number(expQC1.id),
          concept: "QC1",
          steps: [{ text: "QC1 text", title: "QC1" }],
        },
        {
          activityId: Number(expQC2.id),
          concept: "QC2",
          steps: [{ text: "QC2 text", title: "QC2" }],
        },
        {
          activityId: Number(expQC3.id),
          concept: "QC3",
          steps: [{ text: "QC3 text", title: "QC3" }],
        },
        {
          activityId: Number(expQC4.id),
          concept: "QC4",
          steps: [{ text: "QC4 text", title: "QC4" }],
        },
      ];

      await quizActivityWorkflow(activities, "test-run-id", explanationResults, 2);

      const [dbQuiz1, dbQuiz2] = await Promise.all([
        prisma.activity.findUnique({ where: { id: quiz1.id } }),
        prisma.activity.findUnique({ where: { id: quiz2.id } }),
      ]);

      expect(dbQuiz1?.generationStatus).toBe("completed");
      expect(dbQuiz2?.generationStatus).toBe("completed");
    });
  });
});
