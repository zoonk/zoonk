import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { AI_ORG_ID } from "@zoonk/utils/constants";
import { beforeAll, describe, expect, test } from "vitest";
import { createLessons } from "./create-lessons";

describe("createLessons", () => {
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    course = await courseFixture({ organizationId: AI_ORG_ID });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId: AI_ORG_ID,
    });
  });

  test("creates lessons with correct positions", async () => {
    const runId = randomUUID();

    const lessons = [
      {
        description: "Lesson 1 description",
        title: `Lesson 1 ${randomUUID()}`,
      },
      {
        description: "Lesson 2 description",
        title: `Lesson 2 ${randomUUID()}`,
      },
    ];

    const result = await createLessons({
      chapterId: chapter.id,
      generationRunId: runId,
      language: "en",
      lessons,
    });

    expect(result.error).toBeNull();

    const dbLessons = await prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: chapter.id },
    });

    const createdLessons = dbLessons.filter((l) =>
      lessons.some((lesson) => lesson.title === l.title),
    );

    expect(createdLessons).toHaveLength(2);
    expect(createdLessons[0]?.position).toBe(0);
    expect(createdLessons[0]?.title).toBe(lessons[0]?.title);
    expect(createdLessons[1]?.position).toBe(1);
    expect(createdLessons[1]?.title).toBe(lessons[1]?.title);
  });

  test("sets correct generation metadata and AI org", async () => {
    const runId = randomUUID();
    const chapterForTest = await chapterFixture({
      courseId: course.id,
      organizationId: AI_ORG_ID,
    });

    const lessons = [
      {
        description: "Test description",
        title: `Test Lesson ${randomUUID()}`,
      },
    ];

    const result = await createLessons({
      chapterId: chapterForTest.id,
      generationRunId: runId,
      language: "en",
      lessons,
    });

    expect(result.error).toBeNull();

    const dbLesson = await prisma.lesson.findFirst({
      where: { chapterId: chapterForTest.id, title: lessons[0]?.title },
    });

    expect(dbLesson?.organizationId).toBe(AI_ORG_ID);
    expect(dbLesson?.generationRunId).toBe(runId);
    expect(dbLesson?.generationStatus).toBe("completed");
    expect(dbLesson?.isPublished).toBe(true);
  });
});
