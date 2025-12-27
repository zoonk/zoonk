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
import { exportLessons } from "./export-lessons";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const chapter = await chapterFixture({ organizationId: organization.id });

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

    const [headers, chapter] = await Promise.all([
      signInAs(user.email, user.password),
      chapterFixture({ organizationId: organization.id }),
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

    [headers, chapter] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      chapterFixture({ organizationId: fixture.organization.id }),
    ]);
  });

  test("exports lessons successfully", async () => {
    const newChapter = await chapterFixture({
      organizationId: organization.id,
    });

    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({ organizationId: organization.id, title: "Lesson 1" }),
      lessonFixture({ organizationId: organization.id, title: "Lesson 2" }),
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
    const otherChapter = await chapterFixture({ organizationId: otherOrg.id });

    const result = await exportLessons({
      chapterId: otherChapter.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("exports lessons in correct order", async () => {
    const newChapter = await chapterFixture({
      organizationId: organization.id,
    });

    const [lesson1, lesson2, lesson3] = await Promise.all([
      lessonFixture({ organizationId: organization.id, title: "Third" }),
      lessonFixture({ organizationId: organization.id, title: "First" }),
      lessonFixture({ organizationId: organization.id, title: "Second" }),
    ]);

    await Promise.all([
      chapterLessonFixture({
        chapterId: newChapter.id,
        lessonId: lesson1.id,
        position: 2,
      }),
      chapterLessonFixture({
        chapterId: newChapter.id,
        lessonId: lesson2.id,
        position: 0,
      }),
      chapterLessonFixture({
        chapterId: newChapter.id,
        lessonId: lesson3.id,
        position: 1,
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
    const newChapter = await chapterFixture({
      organizationId: organization.id,
    });

    const lesson = await lessonFixture({
      description: "Test Description",
      organizationId: organization.id,
      slug: "test-slug",
      title: "Test Title",
    });

    await chapterLessonFixture({
      chapterId: newChapter.id,
      lessonId: lesson.id,
      position: 0,
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
