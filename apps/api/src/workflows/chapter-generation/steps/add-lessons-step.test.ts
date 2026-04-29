import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { addLessonsStep } from "./add-lessons-step";
import { type ChapterContext } from "./get-chapter-step";

describe(addLessonsStep, () => {
  let organizationId: string;
  let context: ChapterContext;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Add Lessons Chapter ${randomUUID()}`,
    });

    context = {
      ...chapter,
      _count: { lessons: 0 },
      course,
      neighboringChapters: [],
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws without streaming error when DB save fails", async () => {
    const brokenContext: ChapterContext = {
      ...context,
      id: randomUUID(),
    };

    const lessons = [
      { description: "Desc", kind: "explanation" as const, title: `Lesson ${randomUUID()}` },
    ];

    await expect(addLessonsStep({ context: brokenContext, lessons })).rejects.toThrow();

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "addLessons" }),
    );
  });

  test("creates lessons in the database and returns them", async () => {
    const chapter = await chapterFixture({
      courseId: context.course.id,
      organizationId,
      title: `Add Lessons ${randomUUID()}`,
    });

    const chapterContext: ChapterContext = {
      ...chapter,
      _count: { lessons: 0 },
      course: context.course,
      neighboringChapters: [],
    };

    const lessons = [
      {
        description: "First lesson",
        kind: "explanation" as const,
        title: `Lesson 1 ${randomUUID()}`,
      },
      {
        description: "Second lesson",
        kind: "tutorial" as const,
        title: `Lesson 2 ${randomUUID()}`,
      },
    ];

    const result = await addLessonsStep({ context: chapterContext, lessons });

    expect(result).toHaveLength(5);

    const dbLessons = await prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: chapter.id },
    });

    expect(dbLessons).toHaveLength(5);
    expect(dbLessons[0]!.title).toBe(lessons[0]!.title);
    expect(dbLessons[0]!.description).toBe("First lesson");
    expect(dbLessons[0]!.generationStatus).toBe("pending");
    expect(dbLessons[0]!.isPublished).toBe(true);
    expect(dbLessons[0]!.position).toBe(0);
    expect(dbLessons[1]!.position).toBe(1);
    expect(dbLessons[2]!.kind).toBe("tutorial");
    expect(dbLessons[3]!.kind).toBe("quiz");
    expect(dbLessons[3]!.title).toBeNull();
    expect(dbLessons[3]!.description).toBeNull();
    expect(dbLessons[4]!.kind).toBe("review");
    expect(dbLessons[4]!.title).toBeNull();
    expect(dbLessons[4]!.description).toBeNull();
    expect(dbLessons[4]!.generationStatus).toBe("completed");

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "addLessons" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "addLessons" }),
    );
  });

  test("expands language lessons when the course has a target language", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "es" });
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Add Language Lessons ${randomUUID()}`,
    });
    const chapterContext: ChapterContext = {
      ...chapter,
      _count: { lessons: 0 },
      course,
      neighboringChapters: [],
    };

    await addLessonsStep({
      context: chapterContext,
      lessons: [
        {
          description: "Useful words",
          kind: "vocabulary",
          title: `Words ${randomUUID()}`,
        },
      ],
    });

    const dbLessons = await prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: chapter.id },
    });

    expect(dbLessons.map((lesson) => lesson.kind)).toEqual([
      "vocabulary",
      "translation",
      "reading",
      "listening",
      "review",
    ]);
    expect(dbLessons[1]?.title).toBeNull();
    expect(dbLessons[1]?.description).toBeNull();
    expect(dbLessons[2]?.title).toBeNull();
    expect(dbLessons[2]?.description).toBeNull();
    expect(dbLessons[3]?.title).toBeNull();
    expect(dbLessons[3]?.description).toBeNull();
    expect(dbLessons.at(-1)?.generationStatus).toBe("completed");
  });
});
