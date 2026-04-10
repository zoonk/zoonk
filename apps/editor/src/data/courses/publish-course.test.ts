import { ErrorCode } from "@/lib/app-error";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, describe, expect, test } from "vitest";
import { toggleCoursePublished } from "./publish-course";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({
      isPublished: false,
      organizationId: organization.id,
    });

    const result = await toggleCoursePublished({
      courseId: course.id,
      headers: new Headers(),
      isPublished: true,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);
    const course = await courseFixture({
      isPublished: false,
      organizationId: organization.id,
    });

    const result = await toggleCoursePublished({
      courseId: course.id,
      headers,
      isPublished: true,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
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

  test("returns Course not found", async () => {
    const result = await toggleCoursePublished({
      courseId: 999_999,
      headers,
      isPublished: true,
    });

    expect(result.error?.message).toBe(ErrorCode.courseNotFound);
    expect(result.data).toBeNull();
  });

  test("returns Course not found when the course is archived", async () => {
    const archivedCourse = await courseFixture({
      archivedAt: new Date(),
      isPublished: false,
      organizationId: organization.id,
    });

    const result = await toggleCoursePublished({
      courseId: archivedCourse.id,
      headers,
      isPublished: true,
    });

    expect(result.error?.message).toBe(ErrorCode.courseNotFound);
    expect(result.data).toBeNull();
  });

  test("publishes a draft course", async () => {
    const course = await courseFixture({
      isPublished: false,
      organizationId: organization.id,
    });

    const result = await toggleCoursePublished({
      courseId: course.id,
      headers,
      isPublished: true,
    });

    expect(result.error).toBeNull();
    expect(result.data?.isPublished).toBe(true);
  });

  test("unpublishes a published course", async () => {
    const course = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
    });

    const result = await toggleCoursePublished({
      courseId: course.id,
      headers,
      isPublished: false,
    });

    expect(result.error).toBeNull();
    expect(result.data?.isPublished).toBe(false);
  });

  test("publishes all child content when publishing a course", async () => {
    const course = await courseFixture({
      isPublished: false,
      organizationId: organization.id,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: false,
      organizationId: organization.id,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: false,
      organizationId: organization.id,
    });

    const activity = await activityFixture({
      isPublished: false,
      lessonId: lesson.id,
      organizationId: organization.id,
    });

    const step = await stepFixture({
      activityId: activity.id,
      isPublished: false,
    });

    const result = await toggleCoursePublished({
      courseId: course.id,
      headers,
      isPublished: true,
    });

    expect(result.error).toBeNull();
    expect(result.data?.isPublished).toBe(true);

    const [updatedChapter, updatedLesson, updatedActivity, updatedStep] = await Promise.all([
      prisma.chapter.findUniqueOrThrow({ where: { id: chapter.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
      prisma.activity.findUniqueOrThrow({ where: { id: activity.id } }),
      prisma.step.findUniqueOrThrow({ where: { id: step.id } }),
    ]);

    expect(updatedChapter.isPublished).toBe(true);
    expect(updatedLesson.isPublished).toBe(true);
    expect(updatedActivity.isPublished).toBe(true);
    expect(updatedStep.isPublished).toBe(true);
  });

  test("does not publish archived descendants", async () => {
    const course = await courseFixture({
      isPublished: false,
      organizationId: organization.id,
    });

    const [activeChapter, archivedChapter] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        isPublished: false,
        organizationId: organization.id,
      }),
      chapterFixture({
        archivedAt: new Date(),
        courseId: course.id,
        isPublished: false,
        organizationId: organization.id,
      }),
    ]);

    const [activeLesson, archivedLesson] = await Promise.all([
      lessonFixture({
        chapterId: activeChapter.id,
        isPublished: false,
        organizationId: organization.id,
      }),
      lessonFixture({
        archivedAt: new Date(),
        chapterId: activeChapter.id,
        isPublished: false,
        organizationId: organization.id,
      }),
    ]);

    const [activeActivity, archivedActivity] = await Promise.all([
      activityFixture({
        isPublished: false,
        lessonId: activeLesson.id,
        organizationId: organization.id,
      }),
      activityFixture({
        archivedAt: new Date(),
        isPublished: false,
        lessonId: activeLesson.id,
        organizationId: organization.id,
      }),
    ]);

    const [activeStep, archivedStep] = await Promise.all([
      stepFixture({
        activityId: activeActivity.id,
        isPublished: false,
      }),
      stepFixture({
        activityId: activeActivity.id,
        isPublished: false,
      }),
    ]);

    await prisma.step.update({
      data: { archivedAt: new Date() },
      where: { id: archivedStep.id },
    });

    const archivedChapterLesson = await lessonFixture({
      chapterId: archivedChapter.id,
      isPublished: false,
      organizationId: organization.id,
    });

    const archivedChapterActivity = await activityFixture({
      isPublished: false,
      lessonId: archivedChapterLesson.id,
      organizationId: organization.id,
    });

    const result = await toggleCoursePublished({
      courseId: course.id,
      headers,
      isPublished: true,
    });

    expect(result.error).toBeNull();

    const [
      updatedActiveChapter,
      updatedArchivedChapter,
      updatedActiveLesson,
      updatedArchivedLesson,
      updatedArchivedChapterLesson,
      updatedActiveActivity,
      updatedArchivedActivity,
      updatedArchivedChapterActivity,
      updatedActiveStep,
      updatedArchivedStep,
    ] = await Promise.all([
      prisma.chapter.findUniqueOrThrow({ where: { id: activeChapter.id } }),
      prisma.chapter.findUniqueOrThrow({ where: { id: archivedChapter.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: activeLesson.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: archivedLesson.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: archivedChapterLesson.id } }),
      prisma.activity.findUniqueOrThrow({ where: { id: activeActivity.id } }),
      prisma.activity.findUniqueOrThrow({ where: { id: archivedActivity.id } }),
      prisma.activity.findUniqueOrThrow({ where: { id: archivedChapterActivity.id } }),
      prisma.step.findUniqueOrThrow({ where: { id: activeStep.id } }),
      prisma.step.findUniqueOrThrow({ where: { id: archivedStep.id } }),
    ]);

    expect(updatedActiveChapter.isPublished).toBe(true);
    expect(updatedArchivedChapter.isPublished).toBe(false);
    expect(updatedActiveLesson.isPublished).toBe(true);
    expect(updatedArchivedLesson.isPublished).toBe(false);
    expect(updatedArchivedChapterLesson.isPublished).toBe(false);
    expect(updatedActiveActivity.isPublished).toBe(true);
    expect(updatedArchivedActivity.isPublished).toBe(false);
    expect(updatedArchivedChapterActivity.isPublished).toBe(false);
    expect(updatedActiveStep.isPublished).toBe(true);
    expect(updatedArchivedStep.isPublished).toBe(false);
  });

  test("does not cascade unpublish to child content", async () => {
    const course = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
    });

    const activity = await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId: organization.id,
    });

    const step = await stepFixture({
      activityId: activity.id,
      isPublished: true,
    });

    const result = await toggleCoursePublished({
      courseId: course.id,
      headers,
      isPublished: false,
    });

    expect(result.error).toBeNull();
    expect(result.data?.isPublished).toBe(false);

    const [updatedChapter, updatedLesson, updatedActivity, updatedStep] = await Promise.all([
      prisma.chapter.findUniqueOrThrow({ where: { id: chapter.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
      prisma.activity.findUniqueOrThrow({ where: { id: activity.id } }),
      prisma.step.findUniqueOrThrow({ where: { id: step.id } }),
    ]);

    expect(updatedChapter.isPublished).toBe(true);
    expect(updatedLesson.isPublished).toBe(true);
    expect(updatedActivity.isPublished).toBe(true);
    expect(updatedStep.isPublished).toBe(true);
  });

  test("returns Forbidden for course in different organization", async () => {
    const otherOrg = await organizationFixture();

    const course = await courseFixture({
      isPublished: false,
      organizationId: otherOrg.id,
    });

    const result = await toggleCoursePublished({
      courseId: course.id,
      headers,
      isPublished: true,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();

    const unchangedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(unchangedCourse?.isPublished).toBe(false);
  });
});
