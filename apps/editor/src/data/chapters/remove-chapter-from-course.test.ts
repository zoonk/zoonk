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
import { removeChapterFromCourse } from "./remove-chapter-from-course";

describe("unauthenticated users", async () => {
  const organization = await organizationFixture();

  const [course, chapter] = await Promise.all([
    courseFixture({ organizationId: organization.id }),
    chapterFixture({ organizationId: organization.id }),
  ]);

  test("returns Forbidden", async () => {
    await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      position: 0,
    });

    const result = await removeChapterFromCourse({
      chapterId: chapter.id,
      courseId: course.id,
      headers: new Headers(),
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("members", async () => {
  const { organization, user } = await memberFixture({ role: "member" });

  const [headers, course, chapter] = await Promise.all([
    signInAs(user.email, user.password),
    courseFixture({ organizationId: organization.id }),
    chapterFixture({ organizationId: organization.id }),
  ]);

  test("returns Forbidden", async () => {
    await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      position: 0,
    });

    const result = await removeChapterFromCourse({
      chapterId: chapter.id,
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("admins", async () => {
  const { organization, user } = await memberFixture({ role: "admin" });
  const headers = await signInAs(user.email, user.password);

  test("removes chapter from course successfully", async () => {
    const [course, chapter] = await Promise.all([
      courseFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      position: 0,
    });

    const result = await removeChapterFromCourse({
      chapterId: chapter.id,
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.chapterId).toBe(chapter.id);
    expect(result.data?.courseId).toBe(course.id);

    const courseChapter = await prisma.courseChapter.findFirst({
      where: { chapterId: chapter.id, courseId: course.id },
    });

    expect(courseChapter).toBeNull();
  });

  test("keeps chapter after removal from course", async () => {
    const [course, chapter] = await Promise.all([
      courseFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      position: 0,
    });

    await removeChapterFromCourse({
      chapterId: chapter.id,
      courseId: course.id,
      headers,
    });

    const existingChapter = await prisma.chapter.findUnique({
      where: { id: chapter.id },
    });

    expect(existingChapter).not.toBeNull();
    expect(existingChapter?.id).toBe(chapter.id);
  });

  test("removes chapter from one course but keeps it in another", async () => {
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

    await removeChapterFromCourse({
      chapterId: chapter.id,
      courseId: course1.id,
      headers,
    });

    const course1Chapter = await prisma.courseChapter.findFirst({
      where: { chapterId: chapter.id, courseId: course1.id },
    });

    const course2Chapter = await prisma.courseChapter.findFirst({
      where: { chapterId: chapter.id, courseId: course2.id },
    });

    expect(course1Chapter).toBeNull();
    expect(course2Chapter).not.toBeNull();
  });

  test("returns Chapter not found in course", async () => {
    const [course, chapter] = await Promise.all([
      courseFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    const result = await removeChapterFromCourse({
      chapterId: chapter.id,
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe("Chapter not found in course");
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for course in different organization", async () => {
    const otherOrg = await organizationFixture();

    const [course, chapter] = await Promise.all([
      courseFixture({ organizationId: otherOrg.id }),
      chapterFixture({ organizationId: otherOrg.id }),
    ]);

    await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      position: 0,
    });

    const result = await removeChapterFromCourse({
      chapterId: chapter.id,
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("owners", async () => {
  const { organization, user } = await memberFixture({ role: "owner" });
  const headers = await signInAs(user.email, user.password);

  test("removes chapter from course successfully", async () => {
    const [course, chapter] = await Promise.all([
      courseFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      position: 0,
    });

    const result = await removeChapterFromCourse({
      chapterId: chapter.id,
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.chapterId).toBe(chapter.id);
  });
});
