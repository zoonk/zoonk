import { ErrorCode } from "@/lib/app-error";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { createActivity } from "./create-activity";

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

    const result = await createActivity({
      headers: new Headers(),
      kind: "custom",
      lessonId: lesson.id,
      position: 0,
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

    const result = await createActivity({
      headers,
      kind: "custom",
      lessonId: lesson.id,
      position: 0,
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

  test("creates activity successfully", async () => {
    const result = await createActivity({
      description: "Test description",
      headers,
      kind: "background",
      lessonId: lesson.id,
      position: 0,
      title: "Test Activity",
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.title).toBe("Test Activity");
    expect(result.data?.description).toBe("Test description");
    expect(result.data?.organizationId).toBe(organization.id);
    expect(result.data?.lessonId).toBe(lesson.id);
    expect(result.data?.language).toBe(lesson.language);
    expect(result.data?.kind).toBe("background");
  });

  test("creates activity with custom kind", async () => {
    const result = await createActivity({
      headers,
      kind: "custom",
      lessonId: lesson.id,
      position: 0,
    });

    expect(result.error).toBeNull();
    expect(result.data?.kind).toBe("custom");
  });

  test("returns Lesson not found", async () => {
    const result = await createActivity({
      headers,
      kind: "custom",
      lessonId: 999_999,
      position: 0,
    });

    expect(result.error?.message).toBe(ErrorCode.lessonNotFound);
    expect(result.data).toBeNull();
  });

  test("don't allow to create activity for a different organization", async () => {
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

    const result = await createActivity({
      headers,
      kind: "custom",
      lessonId: otherLesson.id,
      position: 0,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("creates activity at correct position", async () => {
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
    const expectedPosition = 5;

    const result = await createActivity({
      headers,
      kind: "custom",
      lessonId: newLesson.id,
      position: expectedPosition,
    });

    expect(result.error).toBeNull();
    expect(result.data?.position).toBe(expectedPosition);
  });

  test("shifts existing activities when creating at position 0", async () => {
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

    const [activity1, activity2] = await Promise.all([
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

    const result = await createActivity({
      headers,
      kind: "custom",
      lessonId: newLesson.id,
      position: 0,
    });

    expect(result.error).toBeNull();

    const activities = await prisma.activity.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: newLesson.id },
    });

    expect(activities.length).toBe(3);
    expect(activities[0]?.id).toBe(result.data?.id);
    expect(activities[0]?.position).toBe(0);
    expect(activities[1]?.id).toBe(activity1.id);
    expect(activities[1]?.position).toBe(1);
    expect(activities[2]?.id).toBe(activity2.id);
    expect(activities[2]?.position).toBe(2);
  });

  test("shifts only activities after insertion point", async () => {
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

    const result = await createActivity({
      headers,
      kind: "custom",
      lessonId: newLesson.id,
      position: 1,
    });

    expect(result.error).toBeNull();

    const activities = await prisma.activity.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: newLesson.id },
    });

    expect(activities.length).toBe(4);
    expect(activities[0]?.id).toBe(activity1.id);
    expect(activities[0]?.position).toBe(0);
    expect(activities[1]?.id).toBe(result.data?.id);
    expect(activities[1]?.position).toBe(1);
    expect(activities[2]?.id).toBe(activity2.id);
    expect(activities[2]?.position).toBe(2);
    expect(activities[3]?.id).toBe(activity3.id);
    expect(activities[3]?.position).toBe(3);
  });

  test("does not shift activities when creating at end", async () => {
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

    const [activity1, activity2] = await Promise.all([
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

    const result = await createActivity({
      headers,
      kind: "custom",
      lessonId: newLesson.id,
      position: 2,
    });

    expect(result.error).toBeNull();

    const activities = await prisma.activity.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: newLesson.id },
    });

    expect(activities.length).toBe(3);
    expect(activities[0]?.id).toBe(activity1.id);
    expect(activities[0]?.position).toBe(0);
    expect(activities[1]?.id).toBe(activity2.id);
    expect(activities[1]?.position).toBe(1);
    expect(activities[2]?.id).toBe(result.data?.id);
    expect(activities[2]?.position).toBe(2);
  });

  test("handles concurrent creations at same position without duplicate positions", async () => {
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

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        createActivity({
          headers,
          kind: "custom",
          lessonId: newLesson.id,
          position: 0,
        }),
      ),
    );

    for (const result of results) {
      expect(result.error).toBeNull();
    }

    const activities = await prisma.activity.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: newLesson.id },
    });

    expect(activities.length).toBe(5);

    const positions = activities.map((a) => a.position);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBe(5);

    const sortedPositions = [...positions].toSorted((a, b) => a - b);
    expect(sortedPositions).toEqual([0, 1, 2, 3, 4]);
  });

  describe("isPublished behavior", () => {
    test("activity is published when lesson is unpublished", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const chapter = await chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      });
      const unpublishedLesson = await lessonFixture({
        chapterId: chapter.id,
        isPublished: false,
        language: course.language,
        organizationId: organization.id,
      });

      const result = await createActivity({
        headers,
        kind: "custom",
        lessonId: unpublishedLesson.id,
        position: 0,
      });

      expect(result.error).toBeNull();
      expect(result.data?.isPublished).toBeTruthy();
    });

    test("activity is unpublished when lesson is published", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const chapter = await chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      });
      const publishedLesson = await lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        language: course.language,
        organizationId: organization.id,
      });

      const result = await createActivity({
        headers,
        kind: "custom",
        lessonId: publishedLesson.id,
        position: 0,
      });

      expect(result.error).toBeNull();
      expect(result.data?.isPublished).toBeFalsy();
    });
  });
});
