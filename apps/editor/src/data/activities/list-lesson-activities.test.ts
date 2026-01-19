import { activityFixture } from "@zoonk/testing/fixtures/activities";
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
import { listLessonActivities } from "./list-lesson-activities";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      language: course.language,
      organizationId: organization.id,
    });

    const result = await listLessonActivities({
      headers: new Headers(),
      lessonSlug: lesson.slug,
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
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const [headers, lesson] = await Promise.all([
      signInAs(user.email, user.password),
      lessonFixture({
        chapterId: chapter.id,
        language: course.language,
        organizationId: organization.id,
      }),
    ]);

    const result = await listLessonActivities({
      headers,
      lessonSlug: lesson.slug,
      orgSlug: organization.slug,
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

    const course = await courseFixture({
      organizationId: fixture.organization.id,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: fixture.organization.id,
    });

    [headers] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      lessonFixture({
        chapterId: chapter.id,
        language: course.language,
        organizationId: fixture.organization.id,
      }),
    ]);
  });

  test("lists activities for a lesson ordered by position", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      language: course.language,
      organizationId: organization.id,
    });

    const [activity1, activity2, activity3] = await Promise.all([
      activityFixture({
        language: course.language,
        lessonId: newLesson.id,
        organizationId: organization.id,
        position: 2,
      }),
      activityFixture({
        language: course.language,
        lessonId: newLesson.id,
        organizationId: organization.id,
        position: 0,
      }),
      activityFixture({
        language: course.language,
        lessonId: newLesson.id,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const result = await listLessonActivities({
      headers,
      lessonSlug: newLesson.slug,
      orgSlug: organization.slug,
    });

    const expectedActivityCount = 3;

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(expectedActivityCount);
    expect(result.data[0]?.id).toBe(activity2.id);
    expect(result.data[0]?.position).toBe(0);
    expect(result.data[1]?.id).toBe(activity3.id);
    expect(result.data[1]?.position).toBe(1);
    expect(result.data[2]?.id).toBe(activity1.id);
    expect(result.data[2]?.position).toBe(2);
  });

  test("returns empty array when lesson has no activities", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const emptyLesson = await lessonFixture({
      chapterId: chapter.id,
      language: course.language,
      organizationId: organization.id,
    });

    const result = await listLessonActivities({
      headers,
      lessonSlug: emptyLesson.slug,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns empty array when lesson not found", async () => {
    const result = await listLessonActivities({
      headers,
      lessonSlug: "non-existent-lesson",
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for lesson in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });
    const otherLesson = await lessonFixture({
      chapterId: otherChapter.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });

    const result = await listLessonActivities({
      headers,
      lessonSlug: otherLesson.slug,
      orgSlug: otherOrg.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });
});
