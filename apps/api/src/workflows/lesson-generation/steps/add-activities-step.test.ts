import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { addActivitiesStep } from "./add-activities-step";

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

describe(addActivitiesStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    const course = await courseFixture({ organizationId });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Test Chapter ${randomUUID()}`,
    });
  });

  async function createLessonAndGetActivities(concepts: string[]) {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Activity Test Lesson ${randomUUID()}`,
    });

    const context = await prisma.lesson.findUniqueOrThrow({
      include: {
        _count: { select: { activities: true } },
        chapter: { include: { course: true } },
      },
      where: { id: lesson.id },
    });

    await addActivitiesStep({
      concepts,
      context,
      customActivities: [],
      lessonKind: "core",
      targetLanguage: null,
    });

    return prisma.activity.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id },
    });
  }

  test("0 concepts → fallback single explanation with null title", async () => {
    const activities = await createLessonAndGetActivities([]);
    const explanations = activities.filter((a) => a.kind === "explanation");

    expect(explanations).toHaveLength(1);
    expect(explanations[0]?.title).toBeNull();
  });

  test("1 concept → 1 explanation with concept as title", async () => {
    const activities = await createLessonAndGetActivities(["Photosynthesis"]);
    const explanations = activities.filter((a) => a.kind === "explanation");

    expect(explanations).toHaveLength(1);
    expect(explanations[0]?.title).toBe("Photosynthesis");
  });

  test("3 concepts → 3 explanations + 1 quiz", async () => {
    const activities = await createLessonAndGetActivities(["A", "B", "C"]);
    const explanations = activities.filter((a) => a.kind === "explanation");
    const quizzes = activities.filter((a) => a.kind === "quiz");

    expect(explanations).toHaveLength(3);
    expect(quizzes).toHaveLength(1);
    expect(explanations.map((item) => item.title)).toEqual(["A", "B", "C"]);
  });

  test("4 concepts → 2 explanation groups + 2 quizzes", async () => {
    const activities = await createLessonAndGetActivities(["A", "B", "C", "D"]);
    const explanations = activities.filter((a) => a.kind === "explanation");
    const quizzes = activities.filter((a) => a.kind === "quiz");

    expect(explanations).toHaveLength(4);
    expect(quizzes).toHaveLength(2);
  });

  test("5 concepts → split 2/3 with quiz between each group", async () => {
    const activities = await createLessonAndGetActivities(["A", "B", "C", "D", "E"]);
    const explanations = activities.filter((a) => a.kind === "explanation");
    const quizzes = activities.filter((a) => a.kind === "quiz");

    expect(explanations).toHaveLength(5);
    expect(quizzes).toHaveLength(2);

    const kinds = activities.map((a) => a.kind);
    const firstQuizIdx = kinds.indexOf("quiz");
    const secondQuizIdx = kinds.indexOf("quiz", firstQuizIdx + 1);

    const explanationsBeforeFirstQuiz = activities
      .slice(0, firstQuizIdx)
      .filter((a) => a.kind === "explanation");
    const explanationsBetweenQuizzes = activities
      .slice(firstQuizIdx + 1, secondQuizIdx)
      .filter((a) => a.kind === "explanation");

    expect(explanationsBeforeFirstQuiz).toHaveLength(2);
    expect(explanationsBetweenQuizzes).toHaveLength(3);
  });

  test("activity order: background, explanations, quiz(es), mechanics, examples, story, challenge, review", async () => {
    const activities = await createLessonAndGetActivities(["A", "B"]);
    const kinds = activities.map((a) => a.kind);

    expect(kinds).toEqual([
      "background",
      "explanation",
      "explanation",
      "quiz",
      "mechanics",
      "examples",
      "story",
      "challenge",
      "review",
    ]);
  });
});
