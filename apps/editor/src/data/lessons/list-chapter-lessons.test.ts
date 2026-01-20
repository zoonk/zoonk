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
      chapterId: chapter.id,
      headers: new Headers(),
      orgId: organization.id,
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
      chapterId: chapter.id,
      headers,
      orgId: organization.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
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
      chapterId: newChapter.id,
      headers,
      orgId: organization.id,
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
      chapterId: emptyChapter.id,
      headers,
      orgId: organization.id,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns empty array when chapterId does not exist", async () => {
    const result = await listChapterLessons({
      chapterId: 999_999_999,
      headers,
      orgId: organization.id,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns empty array for chapter in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });
    await lessonFixture({
      chapterId: otherChapter.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });

    // Try to access using our org's ID but the other chapter's ID
    // Should return empty since the lesson belongs to a different org
    const result = await listChapterLessons({
      chapterId: otherChapter.id,
      headers,
      orgId: organization.id,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });
});
