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
import { addLessonToChapter } from "./add-lesson-to-chapter";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();

    const [chapter, lesson] = await Promise.all([
      chapterFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
    ]);

    const result = await addLessonToChapter({
      chapterId: chapter.id,
      headers: new Headers(),
      lessonId: lesson.id,
      position: 0,
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

    const result = await addLessonToChapter({
      chapterId: chapter.id,
      headers,
      lessonId: lesson.id,
      position: 0,
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

  test("adds lesson to chapter successfully", async () => {
    const [chapter, lesson] = await Promise.all([
      chapterFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
    ]);

    const result = await addLessonToChapter({
      chapterId: chapter.id,
      headers,
      lessonId: lesson.id,
      position: 0,
    });

    expect(result.error).toBeNull();
    expect(result.data?.lessonId).toBe(lesson.id);
    expect(result.data?.chapterId).toBe(chapter.id);
    expect(result.data?.position).toBe(0);
  });

  test("adds same lesson to multiple chapters", async () => {
    const [chapter1, chapter2, lesson] = await Promise.all([
      chapterFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
    ]);

    const [result1, result2] = await Promise.all([
      addLessonToChapter({
        chapterId: chapter1.id,
        headers,
        lessonId: lesson.id,
        position: 0,
      }),
      addLessonToChapter({
        chapterId: chapter2.id,
        headers,
        lessonId: lesson.id,
        position: 0,
      }),
    ]);

    expect(result1.error).toBeNull();
    expect(result2.error).toBeNull();
    expect(result1.data?.chapterId).toBe(chapter1.id);
    expect(result2.data?.chapterId).toBe(chapter2.id);

    const chapterLessons = await prisma.chapterLesson.findMany({
      where: { lessonId: lesson.id },
    });

    expect(chapterLessons.length).toBe(2);
  });

  test("returns error when lesson already in chapter", async () => {
    const [chapter, lesson] = await Promise.all([
      chapterFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
    ]);

    await chapterLessonFixture({
      chapterId: chapter.id,
      lessonId: lesson.id,
      position: 0,
    });

    const result = await addLessonToChapter({
      chapterId: chapter.id,
      headers,
      lessonId: lesson.id,
      position: 1,
    });

    expect(result.error).not.toBeNull();
    expect(result.data).toBeNull();

    const chapterLessons = await prisma.chapterLesson.findMany({
      where: { lessonId: lesson.id },
    });

    expect(chapterLessons.length).toBe(1);
  });

  test("returns Chapter not found", async () => {
    const lesson = await lessonFixture({ organizationId: organization.id });

    const result = await addLessonToChapter({
      chapterId: 999_999,
      headers,
      lessonId: lesson.id,
      position: 0,
    });

    expect(result.error?.message).toBe(ErrorCode.chapterNotFound);
    expect(result.data).toBeNull();
  });

  test("returns Lesson not found", async () => {
    const chapter = await chapterFixture({ organizationId: organization.id });

    const result = await addLessonToChapter({
      chapterId: chapter.id,
      headers,
      lessonId: 999_999,
      position: 0,
    });

    expect(result.error?.message).toBe(ErrorCode.lessonNotFound);
    expect(result.data).toBeNull();
  });

  test("returns error when lesson and chapter belong to different organizations", async () => {
    const [otherOrg, chapter] = await Promise.all([
      organizationFixture(),
      chapterFixture({ organizationId: organization.id }),
    ]);

    const lesson = await lessonFixture({ organizationId: otherOrg.id });

    const result = await addLessonToChapter({
      chapterId: chapter.id,
      headers,
      lessonId: lesson.id,
      position: 0,
    });

    expect(result.error?.message).toBe(ErrorCode.orgMismatch);
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for chapter in different organization", async () => {
    const otherOrg = await organizationFixture();

    const [chapter, lesson] = await Promise.all([
      chapterFixture({ organizationId: otherOrg.id }),
      lessonFixture({ organizationId: otherOrg.id }),
    ]);

    const result = await addLessonToChapter({
      chapterId: chapter.id,
      headers,
      lessonId: lesson.id,
      position: 0,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("shifts existing lessons when inserting at position 0", async () => {
    const [chapter, lesson1, lesson2, newLesson] = await Promise.all([
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
    ]);

    const result = await addLessonToChapter({
      chapterId: chapter.id,
      headers,
      lessonId: newLesson.id,
      position: 0,
    });

    expect(result.error).toBeNull();
    expect(result.data?.position).toBe(0);

    const lessons = await prisma.chapterLesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: chapter.id },
    });

    expect(lessons.length).toBe(3);
    expect(lessons[0]?.lessonId).toBe(newLesson.id);
    expect(lessons[0]?.position).toBe(0);
    expect(lessons[1]?.lessonId).toBe(lesson1.id);
    expect(lessons[1]?.position).toBe(1);
    expect(lessons[2]?.lessonId).toBe(lesson2.id);
    expect(lessons[2]?.position).toBe(2);
  });

  test("handles concurrent additions at same position without duplicate positions", async () => {
    const chapter = await chapterFixture({ organizationId: organization.id });

    const lessons = await Promise.all(
      Array.from({ length: 5 }, () =>
        lessonFixture({ organizationId: organization.id }),
      ),
    );

    const results = await Promise.all(
      lessons.map((lesson) =>
        addLessonToChapter({
          chapterId: chapter.id,
          headers,
          lessonId: lesson.id,
          position: 0,
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

    expect(chapterLessons.length).toBe(5);

    const positions = chapterLessons.map((cl) => cl.position);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBe(5);

    const sortedPositions = [...positions].sort((a, b) => a - b);
    expect(sortedPositions).toEqual([0, 1, 2, 3, 4]);
  });
});
