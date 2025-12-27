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
import { reorderLessons } from "./reorder-lessons";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const chapter = await chapterFixture({ organizationId: organization.id });

    const result = await reorderLessons({
      chapterId: chapter.id,
      headers: new Headers(),
      lessons: [],
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

    const result = await reorderLessons({
      chapterId: chapter.id,
      headers,
      lessons: [],
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

  test("reorders lessons successfully", async () => {
    const [lesson1, lesson2, lesson3] = await Promise.all([
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

    const result = await reorderLessons({
      chapterId: chapter.id,
      headers,
      lessons: [
        { lessonId: lesson3.id, position: 0 },
        { lessonId: lesson1.id, position: 1 },
        { lessonId: lesson2.id, position: 2 },
      ],
    });

    expect(result.error).toBeNull();
    expect(result.data?.updated).toBe(3);

    const reorderedLessons = await prisma.chapterLesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: chapter.id },
    });

    expect(reorderedLessons[0]?.lessonId).toBe(lesson3.id);
    expect(reorderedLessons[1]?.lessonId).toBe(lesson1.id);
    expect(reorderedLessons[2]?.lessonId).toBe(lesson2.id);
  });

  test("returns Chapter not found", async () => {
    const result = await reorderLessons({
      chapterId: 999_999,
      headers,
      lessons: [],
    });

    expect(result.error?.message).toBe(ErrorCode.chapterNotFound);
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for chapter in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherChapter = await chapterFixture({ organizationId: otherOrg.id });

    const result = await reorderLessons({
      chapterId: otherChapter.id,
      headers,
      lessons: [],
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("handles empty lessons array", async () => {
    const result = await reorderLessons({
      chapterId: chapter.id,
      headers,
      lessons: [],
    });

    expect(result.error).toBeNull();
    expect(result.data?.updated).toBe(0);
  });

  test("only updates lessons that exist in the chapter", async () => {
    const lesson = await lessonFixture({ organizationId: organization.id });
    await chapterLessonFixture({
      chapterId: chapter.id,
      lessonId: lesson.id,
      position: 0,
    });

    const expectedPosition = 5;

    const result = await reorderLessons({
      chapterId: chapter.id,
      headers,
      lessons: [
        { lessonId: lesson.id, position: expectedPosition },
        { lessonId: 999_999, position: 0 },
      ],
    });

    expect(result.error).toBeNull();
    expect(result.data?.updated).toBe(1);

    const updatedLesson = await prisma.chapterLesson.findFirst({
      where: { chapterId: chapter.id, lessonId: lesson.id },
    });

    expect(updatedLesson?.position).toBe(expectedPosition);
  });
});
