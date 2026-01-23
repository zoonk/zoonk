import { ErrorCode } from "@/lib/app-error";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { exportActivities } from "./export-activities";

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

    const result = await exportActivities({
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

    const result = await exportActivities({
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
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;

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

    [headers, lesson] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      lessonFixture({
        chapterId: chapter.id,
        language: course.language,
        organizationId: fixture.organization.id,
      }),
    ]);
  });

  test("exports activities successfully", async () => {
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

    await Promise.all([
      activityFixture({
        kind: "background",
        language: course.language,
        lessonId: newLesson.id,
        organizationId: organization.id,
        position: 0,
        title: "Activity 1",
      }),
      activityFixture({
        kind: "quiz",
        language: course.language,
        lessonId: newLesson.id,
        organizationId: organization.id,
        position: 1,
        title: "Activity 2",
      }),
    ]);

    const result = await exportActivities({
      headers,
      lessonId: newLesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.version).toBe(1);
    expect(result.data?.exportedAt).toBeDefined();
    expect(result.data?.activities).toHaveLength(2);
    expect(result.data?.activities[0]?.title).toBe("Activity 1");
    expect(result.data?.activities[0]?.position).toBe(0);
    expect(result.data?.activities[0]?.kind).toBe("background");
    expect(result.data?.activities[1]?.title).toBe("Activity 2");
    expect(result.data?.activities[1]?.position).toBe(1);
    expect(result.data?.activities[1]?.kind).toBe("quiz");
  });

  test("exports empty activities array when lesson has no activities", async () => {
    const result = await exportActivities({
      headers,
      lessonId: lesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.activities).toEqual([]);
  });

  test("returns Lesson not found for non-existent lesson", async () => {
    const result = await exportActivities({
      headers,
      lessonId: 999_999,
    });

    expect(result.error?.message).toBe(ErrorCode.lessonNotFound);
    expect(result.data).toBeNull();
  });

  test("don't allow exporting activities from a different organization", async () => {
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

    const result = await exportActivities({
      headers,
      lessonId: otherLesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("exports activities in correct order", async () => {
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

    await Promise.all([
      activityFixture({
        language: course.language,
        lessonId: newLesson.id,
        organizationId: organization.id,
        position: 2,
        title: "Third",
      }),
      activityFixture({
        language: course.language,
        lessonId: newLesson.id,
        organizationId: organization.id,
        position: 0,
        title: "First",
      }),
      activityFixture({
        language: course.language,
        lessonId: newLesson.id,
        organizationId: organization.id,
        position: 1,
        title: "Second",
      }),
    ]);

    const result = await exportActivities({
      headers,
      lessonId: newLesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.activities).toHaveLength(3);
    expect(result.data?.activities[0]?.title).toBe("First");
    expect(result.data?.activities[0]?.position).toBe(0);
    expect(result.data?.activities[1]?.title).toBe("Second");
    expect(result.data?.activities[1]?.position).toBe(1);
    expect(result.data?.activities[2]?.title).toBe("Third");
    expect(result.data?.activities[2]?.position).toBe(2);
  });

  test("includes all activity fields in export", async () => {
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

    await activityFixture({
      description: "Test Description",
      kind: "explanation",
      language: course.language,
      lessonId: newLesson.id,
      organizationId: organization.id,
      position: 0,
      title: "Test Title",
    });

    const result = await exportActivities({
      headers,
      lessonId: newLesson.id,
    });

    expect(result.error).toBeNull();

    expect(result.data?.activities[0]).toEqual({
      description: "Test Description",
      kind: "explanation",
      position: 0,
      title: "Test Title",
    });
  });
});
