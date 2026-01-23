import { ErrorCode } from "@/lib/app-error";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { exportLessons } from "./export-lessons";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const result = await exportLessons({
      chapterId: chapter.id,
      headers: new Headers(),
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

    const result = await exportLessons({
      chapterId: chapter.id,
      headers,
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

  test("exports lessons successfully", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const newChapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    await Promise.all([
      lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 0,
        title: "Lesson 1",
      }),
      lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 1,
        title: "Lesson 2",
      }),
    ]);

    const result = await exportLessons({
      chapterId: newChapter.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.version).toBe(1);
    expect(result.data?.exportedAt).toBeDefined();
    expect(result.data?.lessons).toHaveLength(2);
    expect(result.data?.lessons[0]?.title).toBe("Lesson 1");
    expect(result.data?.lessons[0]?.position).toBe(0);
    expect(result.data?.lessons[1]?.title).toBe("Lesson 2");
    expect(result.data?.lessons[1]?.position).toBe(1);
  });

  test("exports empty lessons array when chapter has no lessons", async () => {
    const result = await exportLessons({
      chapterId: chapter.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.lessons).toEqual([]);
  });

  test("returns Chapter not found for non-existent chapter", async () => {
    const result = await exportLessons({
      chapterId: 999_999,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.chapterNotFound);
    expect(result.data).toBeNull();
  });

  test("don't allow exporting lessons from a different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });

    const result = await exportLessons({
      chapterId: otherChapter.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("exports lessons in correct order", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const newChapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    await Promise.all([
      lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 2,
        title: "Third",
      }),
      lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 0,
        title: "First",
      }),
      lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 1,
        title: "Second",
      }),
    ]);

    const result = await exportLessons({
      chapterId: newChapter.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.lessons).toHaveLength(3);
    expect(result.data?.lessons[0]?.title).toBe("First");
    expect(result.data?.lessons[0]?.position).toBe(0);
    expect(result.data?.lessons[1]?.title).toBe("Second");
    expect(result.data?.lessons[1]?.position).toBe(1);
    expect(result.data?.lessons[2]?.title).toBe("Third");
    expect(result.data?.lessons[2]?.position).toBe(2);
  });

  test("includes all lesson fields in export", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const newChapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    await lessonFixture({
      chapterId: newChapter.id,
      description: "Test Description",
      language: newChapter.language,
      organizationId: organization.id,
      position: 0,
      slug: "test-slug",
      title: "Test Title",
    });

    const result = await exportLessons({
      chapterId: newChapter.id,
      headers,
    });

    expect(result.error).toBeNull();

    expect(result.data?.lessons[0]).toEqual({
      description: "Test Description",
      position: 0,
      slug: "test-slug",
      title: "Test Title",
    });
  });
});
