import { ErrorCode } from "@/lib/app-error";
import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { reorderLessons } from "./reorder-lessons";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

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
    const course = await courseFixture({ organizationId: organization.id });

    const [headers, chapter] = await Promise.all([
      signInAs(user.email, user.password),
      chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      }),
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
    const course = await courseFixture({
      organizationId: fixture.organization.id,
    });

    [headers, chapter] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: fixture.organization.id,
      }),
    ]);
  });

  test("reorders lessons successfully", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const newChapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const [lesson1, lesson2, lesson3] = await Promise.all([
      lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 2,
      }),
    ]);

    const result = await reorderLessons({
      chapterId: newChapter.id,
      headers,
      lessons: [
        { lessonId: lesson3.id, position: 0 },
        { lessonId: lesson1.id, position: 1 },
        { lessonId: lesson2.id, position: 2 },
      ],
    });

    expect(result.error).toBeNull();
    expect(result.data?.updated).toBe(3);

    const reorderedLessons = await prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: newChapter.id },
    });

    expect(reorderedLessons[0]?.id).toBe(lesson3.id);
    expect(reorderedLessons[1]?.id).toBe(lesson1.id);
    expect(reorderedLessons[2]?.id).toBe(lesson2.id);
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
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });

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
    const course = await courseFixture({ organizationId: organization.id });
    const newChapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const lesson = await lessonFixture({
      chapterId: newChapter.id,
      language: newChapter.language,
      organizationId: organization.id,
      position: 0,
    });

    const expectedPosition = 5;

    const result = await reorderLessons({
      chapterId: newChapter.id,
      headers,
      lessons: [
        { lessonId: lesson.id, position: expectedPosition },
        { lessonId: 999_999, position: 0 },
      ],
    });

    expect(result.error).toBeNull();
    expect(result.data?.updated).toBe(1);

    const updatedLesson = await prisma.lesson.findFirst({
      where: { chapterId: newChapter.id, id: lesson.id },
    });

    expect(updatedLesson?.position).toBe(expectedPosition);
  });
});
