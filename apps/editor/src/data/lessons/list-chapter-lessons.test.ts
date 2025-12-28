import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { listChapterLessons } from "./list-chapter-lessons";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const result = await listChapterLessons({
      chapterSlug: chapter.slug,
      headers: new Headers(),
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
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

    const result = await listChapterLessons({
      chapterSlug: chapter.slug,
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });
});

describe("admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;
  let _chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;
    const course = await courseFixture({
      organizationId: fixture.organization.id,
    });

    [headers, _chapter] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: fixture.organization.id,
      }),
    ]);
  });

  test("lists lessons for a chapter ordered by position", async () => {
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
        position: 2,
      }),
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
    ]);

    const result = await listChapterLessons({
      chapterSlug: newChapter.slug,
      headers,
      orgSlug: organization.slug,
    });

    const expectedLessonCount = 3;

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(expectedLessonCount);
    expect(result.data[0]?.id).toBe(lesson2.id);
    expect(result.data[0]?.position).toBe(0);
    expect(result.data[1]?.id).toBe(lesson3.id);
    expect(result.data[1]?.position).toBe(1);
    expect(result.data[2]?.id).toBe(lesson1.id);
    expect(result.data[2]?.position).toBe(2);
  });

  test("returns empty array when chapter has no lessons", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const emptyChapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const result = await listChapterLessons({
      chapterSlug: emptyChapter.slug,
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns empty array when chapter not found", async () => {
    const result = await listChapterLessons({
      chapterSlug: "non-existent-chapter",
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for chapter in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });

    const result = await listChapterLessons({
      chapterSlug: otherChapter.slug,
      headers,
      orgSlug: otherOrg.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });
});
