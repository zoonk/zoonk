import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import {
  chapterFixture,
  courseChapterFixture,
} from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { deleteCourse } from "./delete-course";

describe("unauthenticated users", async () => {
  const organization = await organizationFixture();

  test("returns Forbidden", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const result = await deleteCourse({
      courseId: course.id,
      headers: new Headers(),
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();

    const unchangedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(unchangedCourse).not.toBeNull();
  });
});

describe("members", async () => {
  const { organization, user } = await memberFixture({ role: "member" });
  const headers = await signInAs(user.email, user.password);

  test("returns Forbidden", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const result = await deleteCourse({
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();

    const unchangedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(unchangedCourse).not.toBeNull();
  });
});

describe("admins", async () => {
  const { organization, user } = await memberFixture({ role: "admin" });
  const headers = await signInAs(user.email, user.password);

  test("returns Forbidden", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const result = await deleteCourse({
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();

    const unchangedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(unchangedCourse).not.toBeNull();
  });
});

describe("owners", async () => {
  const { organization, user } = await memberFixture({ role: "owner" });
  const headers = await signInAs(user.email, user.password);

  test("returns Course not found", async () => {
    const result = await deleteCourse({
      courseId: 999_999,
      headers,
    });

    expect(result.error?.message).toBe("Course not found");
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

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();

    const unchangedCourse = await prisma.course.findUnique({
      where: { id: courseInOtherOrg.id },
    });

    expect(unchangedCourse).not.toBeNull();
  });

  test("cascades deletion to course chapters", async () => {
    const [course, chapter] = await Promise.all([
      courseFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    const courseChapter = await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      position: 0,
    });

    const result = await deleteCourse({
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();

    const deletedCourseChapter = await prisma.courseChapter.findUnique({
      where: { id: courseChapter.id },
    });

    expect(deletedCourseChapter).toBeNull();
  });

  test("deletes orphaned chapters that don't belong to other courses", async () => {
    const [course, chapter] = await Promise.all([
      courseFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      position: 0,
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

  test("does not delete chapters that belong to other courses", async () => {
    const [course1, course2, chapter] = await Promise.all([
      courseFixture({ organizationId: organization.id }),
      courseFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    await Promise.all([
      courseChapterFixture({
        chapterId: chapter.id,
        courseId: course1.id,
        position: 0,
      }),
      courseChapterFixture({
        chapterId: chapter.id,
        courseId: course2.id,
        position: 0,
      }),
    ]);

    const result = await deleteCourse({
      courseId: course1.id,
      headers,
    });

    expect(result.error).toBeNull();

    const remainingChapter = await prisma.chapter.findUnique({
      where: { id: chapter.id },
    });

    expect(remainingChapter).not.toBeNull();

    const remainingCourseChapter = await prisma.courseChapter.findFirst({
      where: { chapterId: chapter.id, courseId: course2.id },
    });

    expect(remainingCourseChapter).not.toBeNull();
  });
});
