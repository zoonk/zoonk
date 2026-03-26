import { randomUUID } from "node:crypto";
import { generateActivityGrammarContent } from "@zoonk/ai/tasks/activities/language/grammar-content";
import { generateActivityGrammarUserContent } from "@zoonk/ai/tasks/activities/language/grammar-user-content";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { grammarActivityWorkflow } from "./grammar-workflow";

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

vi.mock("@zoonk/ai/tasks/activities/language/grammar-content", () => ({
  generateActivityGrammarContent: vi.fn().mockResolvedValue({
    data: {
      examples: [
        {
          highlight: "hablo",
          sentence: "Yo hablo espanol.",
        },
      ],
      exercises: [
        {
          answer: "hablo",
          distractors: ["hablas"],
          template: "Yo [BLANK] espanol.",
        },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/grammar-user-content", () => ({
  generateActivityGrammarUserContent: vi.fn().mockResolvedValue({
    data: {
      discovery: {
        context: null,
        options: [
          { feedback: "Correct", isCorrect: true, text: "Pattern A" },
          { feedback: "Try again", isCorrect: false, text: "Pattern B" },
        ],
        question: null,
      },
      exampleTranslations: ["I speak Spanish."],
      exerciseFeedback: ["First person singular ends with -o."],
      exerciseQuestions: [null],
      exerciseTranslations: ["I [BLANK] Spanish."],
      ruleName: "Present tense endings",
      ruleSummary: "Use -o for yo.",
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/romanization", () => ({
  generateActivityRomanization: vi.fn().mockResolvedValue({
    data: { romanizations: [] },
  }),
}));

async function fetchLessonActivities(lessonId: number): Promise<LessonActivity[]> {
  const activities = await prisma.activity.findMany({
    include: {
      _count: { select: { steps: true } },
      lesson: {
        include: {
          chapter: {
            include: {
              course: { include: { organization: true } },
            },
          },
        },
      },
    },
    orderBy: { position: "asc" },
    where: { lessonId },
  });

  return activities.map((activity) => ({ ...activity, id: Number(activity.id) }));
}

describe(grammarActivityWorkflow, () => {
  let organizationId: number;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId, targetLanguage: "es" });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Grammar Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates grammar steps in correct order (examples, discovery, rule, exercises)", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Steps ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await grammarActivityWorkflow({
      activitiesToGenerate: activities,
      concepts: [],
      neighboringConcepts: [],
      workflowRunId: "test-run-id",
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    // 1 example + 1 discovery + 1 rule + 1 exercise = 4 steps
    expect(steps).toHaveLength(4);

    // Example step (static with grammarExample variant)
    expect(steps[0]?.kind).toBe("static");
    expect(steps[0]?.content).toMatchObject({ highlight: "hablo", variant: "grammarExample" });

    // Discovery step (multipleChoice)
    expect(steps[1]?.kind).toBe("multipleChoice");

    // Rule step (static with grammarRule variant)
    expect(steps[2]?.kind).toBe("static");
    expect(steps[2]?.content).toMatchObject({
      ruleName: "Present tense endings",
      variant: "grammarRule",
    });

    // Exercise step (fillBlank)
    expect(steps[3]?.kind).toBe("fillBlank");
    expect(steps[3]?.content).toMatchObject({ template: "Yo [BLANK] espanol." });
  });

  test("sets grammar status to 'completed' after saving", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Complete ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await grammarActivityWorkflow({
      activitiesToGenerate: activities,
      concepts: [],
      neighboringConcepts: [],
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("completed");
  });

  test("sets grammar status to 'failed' when content AI throws", async () => {
    vi.mocked(generateActivityGrammarContent).mockRejectedValueOnce(new Error("AI failed"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Fail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await grammarActivityWorkflow({
      activitiesToGenerate: activities,
      concepts: [],
      neighboringConcepts: [],
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("sets grammar status to 'failed' when content payload is empty", async () => {
    vi.mocked(generateActivityGrammarContent).mockResolvedValueOnce({
      data: {
        examples: [],
        exercises: [],
      },
    } as unknown as Awaited<ReturnType<typeof generateActivityGrammarContent>>);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Empty ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await grammarActivityWorkflow({
      activitiesToGenerate: activities,
      concepts: [],
      neighboringConcepts: [],
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("sets grammar status to 'failed' when user content AI throws", async () => {
    vi.mocked(generateActivityGrammarUserContent).mockRejectedValueOnce(
      new Error("User content generation failed"),
    );

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar UserContentFail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await grammarActivityWorkflow({
      activitiesToGenerate: activities,
      concepts: [],
      neighboringConcepts: [],
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("skips generation when activity is already completed", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Skip ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "completed",
      kind: "grammar",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    await grammarActivityWorkflow({
      activitiesToGenerate: [],
      concepts: [],
      neighboringConcepts: [],
      workflowRunId: "test-run-id",
    });

    expect(generateActivityGrammarContent).not.toHaveBeenCalled();
  });
});
