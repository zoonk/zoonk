import { prisma } from "@zoonk/db";
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
import { deleteCourse } from "./delete-course";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const result = await deleteCourse({
      courseId: course.id,
      headers: new Headers(),
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();

    const unchangedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(unchangedCourse).not.toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);
    const course = await courseFixture({ organizationId: organization.id });

    const result = await deleteCourse({
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();

    const unchangedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(unchangedCourse).not.toBeNull();
  });
});

describe("admins", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
    const course = await courseFixture({ organizationId: organization.id });

    const result = await deleteCourse({
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();

    const unchangedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(unchangedCourse).not.toBeNull();
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

  test("returns Course not found", async () => {
    const result = await deleteCourse({
      courseId: 999_999,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.courseNotFound);
    expect(result.data).toBeNull();
  });

  test("deletes course successfully", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const result = await deleteCourse({
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(course.id);

    const deletedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(deletedCourse).toBeNull();
  });

  test("returns Forbidden for course in different organization", async () => {
    const otherOrg = await organizationFixture();

    const courseInOtherOrg = await courseFixture({
      organizationId: otherOrg.id,
    });

    const result = await deleteCourse({
      courseId: courseInOtherOrg.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();

    const unchangedCourse = await prisma.course.findUnique({
      where: { id: courseInOtherOrg.id },
    });

    expect(unchangedCourse).not.toBeNull();
  });

  test("cascades deletion to chapters", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const result = await deleteCourse({
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();

    const deletedChapter = await prisma.chapter.findUnique({
      where: { id: chapter.id },
    });

    expect(deletedChapter).toBeNull();
  });

  test("cascades deletion to lessons through chapters", async () => {
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

    const result = await deleteCourse({
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();

    const deletedLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });

    expect(deletedLesson).toBeNull();
  });
});
