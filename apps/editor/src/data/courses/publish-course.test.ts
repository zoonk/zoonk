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
    expect(result.data?.isPublished).toBeTruthy();
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
    expect(result.data?.isPublished).toBeFalsy();
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
    expect(result.data?.isPublished).toBeTruthy();

    const [updatedChapter, updatedLesson, updatedActivity, updatedStep] = await Promise.all([
      prisma.chapter.findUniqueOrThrow({ where: { id: chapter.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
      prisma.activity.findUniqueOrThrow({ where: { id: activity.id } }),
      prisma.step.findUniqueOrThrow({ where: { id: step.id } }),
    ]);

    expect(updatedChapter.isPublished).toBeTruthy();
    expect(updatedLesson.isPublished).toBeTruthy();
    expect(updatedActivity.isPublished).toBeTruthy();
    expect(updatedStep.isPublished).toBeTruthy();
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
    expect(result.data?.isPublished).toBeFalsy();

    const [updatedChapter, updatedLesson, updatedActivity, updatedStep] = await Promise.all([
      prisma.chapter.findUniqueOrThrow({ where: { id: chapter.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
      prisma.activity.findUniqueOrThrow({ where: { id: activity.id } }),
      prisma.step.findUniqueOrThrow({ where: { id: step.id } }),
    ]);

    expect(updatedChapter.isPublished).toBeTruthy();
    expect(updatedLesson.isPublished).toBeTruthy();
    expect(updatedActivity.isPublished).toBeTruthy();
    expect(updatedStep.isPublished).toBeTruthy();
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

    expect(unchangedCourse?.isPublished).toBeFalsy();
  });
});
