import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import {
  chapterLessonFixture,
  lessonFixture,
} from "@zoonk/testing/fixtures/lessons";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { removeLessonFromChapter } from "./remove-lesson-from-chapter";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();

    const [chapter, lesson] = await Promise.all([
      chapterFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
    ]);

    await chapterLessonFixture({
      chapterId: chapter.id,
      lessonId: lesson.id,
      position: 0,
    });

    const result = await removeLessonFromChapter({
      chapterId: chapter.id,
      headers: new Headers(),
      lessonId: lesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });

    const [headers, chapter, lesson] = await Promise.all([
      signInAs(user.email, user.password),
      chapterFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
    ]);

    await chapterLessonFixture({
      chapterId: chapter.id,
      lessonId: lesson.id,
      position: 0,
    });

    const result = await removeLessonFromChapter({
      chapterId: chapter.id,
      headers,
      lessonId: lesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;
    headers = await signInAs(fixture.user.email, fixture.user.password);
  });

  test("removes lesson from chapter successfully", async () => {
    const [chapter, lesson] = await Promise.all([
      chapterFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
    ]);

    await chapterLessonFixture({
      chapterId: chapter.id,
      lessonId: lesson.id,
      position: 0,
    });

    const result = await removeLessonFromChapter({
      chapterId: chapter.id,
      headers,
      lessonId: lesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.lessonId).toBe(lesson.id);
    expect(result.data?.chapterId).toBe(chapter.id);

    const chapterLesson = await prisma.chapterLesson.findFirst({
      where: { chapterId: chapter.id, lessonId: lesson.id },
    });

    expect(chapterLesson).toBeNull();
  });

  test("deletes orphaned lesson after removal from chapter", async () => {
    const [chapter, lesson] = await Promise.all([
      chapterFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
    ]);

    await chapterLessonFixture({
      chapterId: chapter.id,
      lessonId: lesson.id,
      position: 0,
    });

    await removeLessonFromChapter({
      chapterId: chapter.id,
      headers,
      lessonId: lesson.id,
    });

    const deletedLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });

    expect(deletedLesson).toBeNull();
  });

  test("keeps lesson when it is linked to another chapter", async () => {
    const [chapter1, chapter2, lesson] = await Promise.all([
      chapterFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
    ]);

    await Promise.all([
      chapterLessonFixture({
        chapterId: chapter1.id,
        lessonId: lesson.id,
        position: 0,
      }),
      chapterLessonFixture({
        chapterId: chapter2.id,
        lessonId: lesson.id,
        position: 0,
      }),
    ]);

    await removeLessonFromChapter({
      chapterId: chapter1.id,
      headers,
      lessonId: lesson.id,
    });

    const chapter1Lesson = await prisma.chapterLesson.findFirst({
      where: { chapterId: chapter1.id, lessonId: lesson.id },
    });

    const chapter2Lesson = await prisma.chapterLesson.findFirst({
      where: { chapterId: chapter2.id, lessonId: lesson.id },
    });

    const existingLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });

    expect(chapter1Lesson).toBeNull();
    expect(chapter2Lesson).not.toBeNull();
    expect(existingLesson).not.toBeNull();
    expect(existingLesson?.id).toBe(lesson.id);
  });

  test("returns Lesson not found in chapter", async () => {
    const [chapter, lesson] = await Promise.all([
      chapterFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
    ]);

    const result = await removeLessonFromChapter({
      chapterId: chapter.id,
      headers,
      lessonId: lesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.lessonNotInChapter);
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for chapter in different organization", async () => {
    const otherOrg = await organizationFixture();

    const [chapter, lesson] = await Promise.all([
      chapterFixture({ organizationId: otherOrg.id }),
      lessonFixture({ organizationId: otherOrg.id }),
    ]);

    await chapterLessonFixture({
      chapterId: chapter.id,
      lessonId: lesson.id,
      position: 0,
    });

    const result = await removeLessonFromChapter({
      chapterId: chapter.id,
      headers,
      lessonId: lesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("closes gap in positions after removal", async () => {
    const [chapter, lesson1, lesson2, lesson3] = await Promise.all([
      chapterFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
    ]);

    await Promise.all([
      chapterLessonFixture({
        chapterId: chapter.id,
        lessonId: lesson1.id,
        position: 0,
      }),
      chapterLessonFixture({
        chapterId: chapter.id,
        lessonId: lesson2.id,
        position: 1,
      }),
      chapterLessonFixture({
        chapterId: chapter.id,
        lessonId: lesson3.id,
        position: 2,
      }),
    ]);

    await removeLessonFromChapter({
      chapterId: chapter.id,
      headers,
      lessonId: lesson2.id,
    });

    const lessons = await prisma.chapterLesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: chapter.id },
    });

    expect(lessons.length).toBe(2);
    expect(lessons[0]?.lessonId).toBe(lesson1.id);
    expect(lessons[0]?.position).toBe(0);
    expect(lessons[1]?.lessonId).toBe(lesson3.id);
    expect(lessons[1]?.position).toBe(1);
  });

  test("handles concurrent removals without duplicate positions", async () => {
    const chapter = await chapterFixture({ organizationId: organization.id });

    const lessons = await Promise.all(
      Array.from({ length: 5 }, () =>
        lessonFixture({ organizationId: organization.id }),
      ),
    );

    await Promise.all(
      lessons.map((lesson, index) =>
        chapterLessonFixture({
          chapterId: chapter.id,
          lessonId: lesson.id,
          position: index,
        }),
      ),
    );

    const results = await Promise.all(
      lessons.slice(0, 3).map((lesson) =>
        removeLessonFromChapter({
          chapterId: chapter.id,
          headers,
          lessonId: lesson.id,
        }),
      ),
    );

    for (const result of results) {
      expect(result.error).toBeNull();
    }

    const chapterLessons = await prisma.chapterLesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: chapter.id },
    });

    expect(chapterLessons.length).toBe(2);

    const positions = chapterLessons.map((cl) => cl.position);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBe(2);

    const sortedPositions = [...positions].sort((a, b) => a - b);
    expect(sortedPositions).toEqual([0, 1]);
  });
});
