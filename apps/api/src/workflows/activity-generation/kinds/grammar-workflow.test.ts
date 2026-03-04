import { randomUUID } from "node:crypto";
import { generateActivityGrammar } from "@zoonk/ai/tasks/activities/language/grammar";
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

vi.mock("@zoonk/ai/tasks/activities/language/grammar", () => ({
  generateActivityGrammar: vi.fn().mockResolvedValue({
    data: {
      discovery: {
        options: [
          { feedback: "Correct", isCorrect: true, text: "Pattern A" },
          { feedback: "Try again", isCorrect: false, text: "Pattern B" },
        ],
      },
      examples: [
        {
          highlight: "hablo",
          romanization: "ha-blo",
          sentence: "Yo hablo espanol.",
          translation: "I speak Spanish.",
        },
      ],
      exercises: [
        {
          answers: ["hablo"],
          distractors: ["hablas"],
          feedback: "First person singular ends with -o.",
          template: "Yo [BLANK] espanol.",
        },
      ],
      ruleName: "Present tense endings",
      ruleSummary: "Use -o for yo.",
    },
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
    await grammarActivityWorkflow(activities, "test-run-id", [], []);

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
    await grammarActivityWorkflow(activities, "test-run-id", [], []);

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("completed");
  });

  test("sets grammar status to 'failed' when AI throws", async () => {
    vi.mocked(generateActivityGrammar).mockRejectedValueOnce(new Error("AI failed"));

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
    await grammarActivityWorkflow(activities, "test-run-id", [], []);

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("sets grammar status to 'failed' when grammar payload is empty", async () => {
    vi.mocked(generateActivityGrammar).mockResolvedValueOnce({
      data: {
        discovery: { options: [] },
        examples: [],
        exercises: [],
        ruleName: "",
        ruleSummary: "",
      },
    } as unknown as Awaited<ReturnType<typeof generateActivityGrammar>>);

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
    await grammarActivityWorkflow(activities, "test-run-id", [], []);

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

    const activities = await fetchLessonActivities(lesson.id);
    await grammarActivityWorkflow(activities, "test-run-id", [], []);

    expect(generateActivityGrammar).not.toHaveBeenCalled();
  });
});
