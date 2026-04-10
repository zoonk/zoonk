import { randomUUID } from "node:crypto";
import { ErrorCode } from "@/lib/app-error";
import { prisma } from "@zoonk/db";
import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { deleteLesson } from "./delete-lesson";

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
      language: chapter.language,
      organizationId: organization.id,
    });

    const result = await deleteLesson({
      headers: new Headers(),
      lessonId: lesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();

    const unchangedLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });

    expect(unchangedLesson).not.toBeNull();
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
    const headers = await signInAs(user.email, user.password);
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      language: chapter.language,
      organizationId: organization.id,
    });

    const result = await deleteLesson({
      headers,
      lessonId: lesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();

    const unchangedLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });

    expect(unchangedLesson).not.toBeNull();
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

  test("deletes unpublished lesson successfully", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: false,
      language: chapter.language,
      organizationId: organization.id,
    });

    const result = await deleteLesson({
      headers,
      lessonId: lesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(lesson.id);

    const deletedLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });

    expect(deletedLesson).toBeNull();
  });

  test("archives a learner-touched lesson without returning an error", async () => {
    const user = await userFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: false,
      language: chapter.language,
      organizationId: organization.id,
    });
    const activity = await activityFixture({
      lessonId: lesson.id,
      organizationId: organization.id,
    });

    await activityProgressFixture({
      activityId: activity.id,
      completedAt: new Date(),
      durationSeconds: 30,
      userId: Number(user.id),
    });

    const result = await deleteLesson({
      headers,
      lessonId: lesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(lesson.id);
    expect(result.data?.archivedAt).not.toBeNull();

    const unchangedLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });

    expect(unchangedLesson).not.toBeNull();
    expect(unchangedLesson?.archivedAt).not.toBeNull();
  });

  test("returns Forbidden for a published lesson", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: chapter.language,
      organizationId: organization.id,
    });

    const result = await deleteLesson({
      headers,
      lessonId: lesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();

    const unchangedLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });

    expect(unchangedLesson).not.toBeNull();
    expect(unchangedLesson?.archivedAt).toBeNull();
  });
});

describe("owners", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "owner" });
    organization = fixture.organization;
    headers = await signInAs(fixture.user.email, fixture.user.password);
  });

  test("returns Lesson not found", async () => {
    const result = await deleteLesson({
      headers,
      lessonId: 999_999,
    });

    expect(result.error?.message).toBe(ErrorCode.lessonNotFound);
    expect(result.data).toBeNull();
  });

  test("deletes lesson successfully", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      language: chapter.language,
      organizationId: organization.id,
    });

    const result = await deleteLesson({
      headers,
      lessonId: lesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(lesson.id);

    const deletedLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });

    expect(deletedLesson).toBeNull();
  });

  test("hard deletes a published lesson with no learner history", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: chapter.language,
      organizationId: organization.id,
    });

    const result = await deleteLesson({
      headers,
      lessonId: lesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(lesson.id);

    const deletedLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });

    expect(deletedLesson).toBeNull();
  });

  test("archives learner-touched lessons instead of deleting them", async () => {
    const user = await userFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: false,
      language: chapter.language,
      organizationId: organization.id,
    });
    const activity = await activityFixture({
      lessonId: lesson.id,
      organizationId: organization.id,
    });

    await activityProgressFixture({
      activityId: activity.id,
      completedAt: new Date(),
      durationSeconds: 45,
      userId: Number(user.id),
    });

    const result = await deleteLesson({
      headers,
      lessonId: lesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(lesson.id);
    expect(result.data?.archivedAt).not.toBeNull();

    const [archivedLesson, unchangedActivity] = await Promise.all([
      prisma.lesson.findUnique({
        where: { id: lesson.id },
      }),
      prisma.activity.findUnique({
        where: { id: activity.id },
      }),
    ]);

    expect(archivedLesson?.archivedAt).not.toBeNull();
    expect(unchangedActivity).not.toBeNull();
  });

  test("releases the lesson slug when archiving", async () => {
    const user = await userFixture();
    const originalSlug = `reusable-lesson-slug-${randomUUID().slice(0, 8)}`;
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: false,
      language: chapter.language,
      organizationId: organization.id,
      slug: originalSlug,
    });
    const activity = await activityFixture({
      lessonId: lesson.id,
      organizationId: organization.id,
    });

    await activityProgressFixture({
      activityId: activity.id,
      completedAt: new Date(),
      durationSeconds: 45,
      userId: Number(user.id),
    });

    const result = await deleteLesson({
      headers,
      lessonId: lesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.archivedAt).not.toBeNull();
    expect(result.data?.slug).not.toBe(originalSlug);

    const [archivedLesson, replacementLesson] = await Promise.all([
      prisma.lesson.findUnique({
        where: { id: lesson.id },
      }),
      lessonFixture({
        chapterId: chapter.id,
        language: chapter.language,
        organizationId: organization.id,
        slug: originalSlug,
      }),
    ]);

    expect(archivedLesson?.slug).not.toBe(originalSlug);
    expect(replacementLesson.slug).toBe(originalSlug);
  });

  test("returns Forbidden for lesson in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });

    const lessonInOtherOrg = await lessonFixture({
      chapterId: otherChapter.id,
      language: otherChapter.language,
      organizationId: otherOrg.id,
    });

    const result = await deleteLesson({
      headers,
      lessonId: lessonInOtherOrg.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();

    const unchangedLesson = await prisma.lesson.findUnique({
      where: { id: lessonInOtherOrg.id },
    });

    expect(unchangedLesson).not.toBeNull();
  });
});
