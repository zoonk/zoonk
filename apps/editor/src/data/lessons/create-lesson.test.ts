import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import {
  chapterLessonFixture,
  lessonAttrs,
  lessonFixture,
} from "@zoonk/testing/fixtures/lessons";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { createLesson } from "./create-lesson";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const chapter = await chapterFixture({ organizationId: organization.id });

    const result = await createLesson({
      ...lessonAttrs(),
      chapterId: chapter.id,
      headers: new Headers(),
      position: 0,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });

    const [headers, chapter] = await Promise.all([
      signInAs(user.email, user.password),
      chapterFixture({ organizationId: organization.id }),
    ]);

    const result = await createLesson({
      ...lessonAttrs(),
      chapterId: chapter.id,
      headers,
      position: 0,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;

    [headers, chapter] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      chapterFixture({ organizationId: fixture.organization.id }),
    ]);
  });

  test("creates lesson successfully", async () => {
    const attrs = lessonAttrs();

    const result = await createLesson({
      ...attrs,
      chapterId: chapter.id,
      headers,
      position: 0,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.lesson.title).toBe(attrs.title);
    expect(result.data?.lesson.description).toBe(attrs.description);
    expect(result.data?.lesson.organizationId).toBe(organization.id);
    expect(result.data?.chapterLessonId).toBeDefined();
  });

  test("normalizes slug", async () => {
    const attrs = lessonAttrs();

    const result = await createLesson({
      ...attrs,
      chapterId: chapter.id,
      headers,
      position: 0,
      slug: "My Test Lesson!",
    });

    expect(result.error).toBeNull();
    expect(result.data?.lesson.slug).toBe("my-test-lesson");
  });

  test("normalizes title for search", async () => {
    const attrs = lessonAttrs();

    const result = await createLesson({
      ...attrs,
      chapterId: chapter.id,
      headers,
      position: 0,
      title: "Introdução à Programação",
    });

    expect(result.error).toBeNull();
    expect(result.data?.lesson.normalizedTitle).toBe(
      "introducao a programacao",
    );
  });

  test("returns Chapter not found", async () => {
    const result = await createLesson({
      ...lessonAttrs(),
      chapterId: 999_999,
      headers,
      position: 0,
    });

    expect(result.error?.message).toBe(ErrorCode.chapterNotFound);
    expect(result.data).toBeNull();
  });

  test("don't allow to create lesson for a different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherChapter = await chapterFixture({ organizationId: otherOrg.id });

    const result = await createLesson({
      ...lessonAttrs(),
      chapterId: otherChapter.id,
      headers,
      position: 0,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("returns error when slug already exists for same org", async () => {
    const attrs = lessonAttrs();

    await createLesson({
      ...attrs,
      chapterId: chapter.id,
      headers,
      position: 0,
    });

    const result = await createLesson({
      ...attrs,
      chapterId: chapter.id,
      headers,
      position: 1,
    });

    expect(result.error).not.toBeNull();
  });

  test("creates lesson at correct position", async () => {
    const attrs = lessonAttrs();
    const expectedPosition = 5;

    const result = await createLesson({
      ...attrs,
      chapterId: chapter.id,
      headers,
      position: expectedPosition,
    });

    expect(result.error).toBeNull();

    const chapterLesson = await prisma.chapterLesson.findUnique({
      where: { id: result.data?.chapterLessonId },
    });

    expect(chapterLesson?.position).toBe(expectedPosition);
  });

  test("shifts existing lessons when creating at position 0", async () => {
    const newChapter = await chapterFixture({
      organizationId: organization.id,
    });

    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
    ]);

    await Promise.all([
      chapterLessonFixture({
        chapterId: newChapter.id,
        lessonId: lesson1.id,
        position: 0,
      }),
      chapterLessonFixture({
        chapterId: newChapter.id,
        lessonId: lesson2.id,
        position: 1,
      }),
    ]);

    const result = await createLesson({
      ...lessonAttrs(),
      chapterId: newChapter.id,
      headers,
      position: 0,
    });

    expect(result.error).toBeNull();

    const lessons = await prisma.chapterLesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: newChapter.id },
    });

    expect(lessons.length).toBe(3);
    expect(lessons[0]?.lessonId).toBe(result.data?.lesson.id);
    expect(lessons[0]?.position).toBe(0);
    expect(lessons[1]?.lessonId).toBe(lesson1.id);
    expect(lessons[1]?.position).toBe(1);
    expect(lessons[2]?.lessonId).toBe(lesson2.id);
    expect(lessons[2]?.position).toBe(2);
  });

  test("shifts only lessons after insertion point", async () => {
    const newChapter = await chapterFixture({
      organizationId: organization.id,
    });

    const [lesson1, lesson2, lesson3] = await Promise.all([
      lessonFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
    ]);

    await Promise.all([
      chapterLessonFixture({
        chapterId: newChapter.id,
        lessonId: lesson1.id,
        position: 0,
      }),
      chapterLessonFixture({
        chapterId: newChapter.id,
        lessonId: lesson2.id,
        position: 1,
      }),
      chapterLessonFixture({
        chapterId: newChapter.id,
        lessonId: lesson3.id,
        position: 2,
      }),
    ]);

    const result = await createLesson({
      ...lessonAttrs(),
      chapterId: newChapter.id,
      headers,
      position: 1,
    });

    expect(result.error).toBeNull();

    const lessons = await prisma.chapterLesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: newChapter.id },
    });

    expect(lessons.length).toBe(4);
    expect(lessons[0]?.lessonId).toBe(lesson1.id);
    expect(lessons[0]?.position).toBe(0);
    expect(lessons[1]?.lessonId).toBe(result.data?.lesson.id);
    expect(lessons[1]?.position).toBe(1);
    expect(lessons[2]?.lessonId).toBe(lesson2.id);
    expect(lessons[2]?.position).toBe(2);
    expect(lessons[3]?.lessonId).toBe(lesson3.id);
    expect(lessons[3]?.position).toBe(3);
  });

  test("does not shift lessons when creating at end", async () => {
    const newChapter = await chapterFixture({
      organizationId: organization.id,
    });

    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
    ]);

    await Promise.all([
      chapterLessonFixture({
        chapterId: newChapter.id,
        lessonId: lesson1.id,
        position: 0,
      }),
      chapterLessonFixture({
        chapterId: newChapter.id,
        lessonId: lesson2.id,
        position: 1,
      }),
    ]);

    const result = await createLesson({
      ...lessonAttrs(),
      chapterId: newChapter.id,
      headers,
      position: 2,
    });

    expect(result.error).toBeNull();

    const lessons = await prisma.chapterLesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: newChapter.id },
    });

    expect(lessons.length).toBe(3);
    expect(lessons[0]?.lessonId).toBe(lesson1.id);
    expect(lessons[0]?.position).toBe(0);
    expect(lessons[1]?.lessonId).toBe(lesson2.id);
    expect(lessons[1]?.position).toBe(1);
    expect(lessons[2]?.lessonId).toBe(result.data?.lesson.id);
    expect(lessons[2]?.position).toBe(2);
  });

  test("handles concurrent creations at same position without duplicate positions", async () => {
    const newChapter = await chapterFixture({
      organizationId: organization.id,
    });

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        createLesson({
          ...lessonAttrs(),
          chapterId: newChapter.id,
          headers,
          position: 0,
        }),
      ),
    );

    for (const result of results) {
      expect(result.error).toBeNull();
    }

    const lessons = await prisma.chapterLesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: newChapter.id },
    });

    expect(lessons.length).toBe(5);

    const positions = lessons.map((cl) => cl.position);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBe(5);

    const sortedPositions = [...positions].sort((a, b) => a - b);
    expect(sortedPositions).toEqual([0, 1, 2, 3, 4]);
  });
});
