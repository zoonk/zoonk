import { ErrorCode } from "@/lib/app-error";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { reorderActivities } from "./reorder-activities";

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

    const result = await reorderActivities({
      activities: [],
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

    const result = await reorderActivities({
      activities: [],
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

  test("reorders activities successfully", async () => {
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
        position: 0,
      }),
      activityFixture({
        language: course.language,
        lessonId: newLesson.id,
        organizationId: organization.id,
        position: 1,
      }),
      activityFixture({
        language: course.language,
        lessonId: newLesson.id,
        organizationId: organization.id,
        position: 2,
      }),
    ]);

    const result = await reorderActivities({
      activities: [
        { activityId: activity3.id, position: 0 },
        { activityId: activity1.id, position: 1 },
        { activityId: activity2.id, position: 2 },
      ],
      headers,
      lessonId: newLesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.updated).toBe(3);

    const reorderedActivities = await prisma.activity.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: newLesson.id },
    });

    expect(reorderedActivities[0]?.id).toBe(activity3.id);
    expect(reorderedActivities[1]?.id).toBe(activity1.id);
    expect(reorderedActivities[2]?.id).toBe(activity2.id);
  });

  test("returns Lesson not found", async () => {
    const result = await reorderActivities({
      activities: [],
      headers,
      lessonId: 999_999,
    });

    expect(result.error?.message).toBe(ErrorCode.lessonNotFound);
    expect(result.data).toBeNull();
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

    const result = await reorderActivities({
      activities: [],
      headers,
      lessonId: otherLesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("handles empty activities array", async () => {
    const result = await reorderActivities({
      activities: [],
      headers,
      lessonId: lesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.updated).toBe(0);
  });

  test("only updates activities that exist in the lesson", async () => {
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

    const activity = await activityFixture({
      language: course.language,
      lessonId: newLesson.id,
      organizationId: organization.id,
      position: 0,
    });

    const expectedPosition = 5;

    const result = await reorderActivities({
      activities: [
        { activityId: activity.id, position: expectedPosition },
        { activityId: BigInt(999_999), position: 0 },
      ],
      headers,
      lessonId: newLesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.updated).toBe(1);

    const updatedActivity = await prisma.activity.findFirst({
      where: { id: activity.id, lessonId: newLesson.id },
    });

    expect(updatedActivity?.position).toBe(expectedPosition);
  });
});
