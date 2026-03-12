import { randomUUID } from "node:crypto";
import { generateActivityPracticeLanguage } from "@zoonk/ai/tasks/activities/language/practice";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { languagePracticeActivityWorkflow } from "./language-practice-workflow";

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

vi.mock("@zoonk/ai/tasks/activities/language/practice", () => ({
  generateActivityPracticeLanguage: vi.fn().mockResolvedValue({
    data: {
      scenario: "You're in a Madrid bakery.",
      steps: [
        {
          context: "The clerk smiles and asks what you'd like.",
          contextRomanization: null,
          contextTranslation: "The clerk smiles.",
          options: [
            {
              feedback: "Perfectly polite.",
              isCorrect: true,
              text: "Buenos dias.",
              textRomanization: "bweh-nos dee-as",
            },
            {
              feedback: "Too abrupt.",
              isCorrect: false,
              text: "Dame cafe.",
              textRomanization: "da-me ka-fe",
            },
          ],
        },
      ],
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

describe(languagePracticeActivityWorkflow, () => {
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
      title: `LangPractice Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates language practice steps (scenario + multipleChoice) in database", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LangPractice Steps ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languagePractice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Language Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await languagePracticeActivityWorkflow(activities, "test-run-id", [], []);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    // 1 scenario step + 1 multipleChoice step = 2 steps
    expect(steps).toHaveLength(2);

    // Scenario step (static)
    expect(steps[0]?.kind).toBe("static");
    expect(steps[0]?.content).toMatchObject({
      text: "You're in a Madrid bakery.",
      title: "Scenario",
      variant: "text",
    });
    expect(steps[0]?.position).toBe(0);

    // MultipleChoice step
    expect(steps[1]?.kind).toBe("multipleChoice");
    expect(steps[1]?.content).toMatchObject({
      context: "The clerk smiles and asks what you'd like.",
      kind: "language",
    });
    expect(steps[1]?.position).toBe(1);
  });

  test("sets language practice status to 'completed' after saving", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LangPractice Complete ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languagePractice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Language Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await languagePracticeActivityWorkflow(activities, "test-run-id", [], []);

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("completed");
  });

  test("sets language practice status to 'failed' when AI throws", async () => {
    vi.mocked(generateActivityPracticeLanguage).mockRejectedValueOnce(new Error("AI failed"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LangPractice Fail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languagePractice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Language Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await languagePracticeActivityWorkflow(activities, "test-run-id", [], []);

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("converts empty romanization to null for Roman-script languages", async () => {
    vi.mocked(generateActivityPracticeLanguage).mockResolvedValueOnce({
      data: {
        scenario: "You're at a cafe in Madrid ordering breakfast.",
        steps: [
          {
            context: "Buenos días, ¿qué le pongo?",
            contextRomanization: "",
            contextTranslation: "Good morning, what can I get you?",
            options: [
              {
                feedback: "Perfectly polite and natural.",
                isCorrect: true,
                text: "Un café con leche, por favor.",
                textRomanization: "",
              },
              {
                feedback: "Too abrupt.",
                isCorrect: false,
                text: "Dame café.",
                textRomanization: "",
              },
            ],
          },
        ],
      },
    } as Awaited<ReturnType<typeof generateActivityPracticeLanguage>>);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LangPractice EmptyRoman ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languagePractice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Language Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await languagePracticeActivityWorkflow(activities, "test-run-id", [], []);

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("completed");

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(2);
    expect(steps[1]?.content).toMatchObject({
      contextRomanization: null,
      options: expect.arrayContaining([expect.objectContaining({ textRomanization: null })]),
    });
  });

  test("skips generation when activity is already completed", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LangPractice Skip ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "completed",
      kind: "languagePractice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Language Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await languagePracticeActivityWorkflow(activities, "test-run-id", [], []);

    expect(generateActivityPracticeLanguage).not.toHaveBeenCalled();
  });
});
