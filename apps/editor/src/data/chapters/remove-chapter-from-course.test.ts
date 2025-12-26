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

  test("deletes orphaned chapter after removal from course", async () => {
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

    const deletedChapter = await prisma.chapter.findUnique({
      where: { id: chapter.id },
    });

    expect(deletedChapter).toBeNull();
  });

  test("keeps chapter when it is linked to another course", async () => {
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

    const existingChapter = await prisma.chapter.findUnique({
      where: { id: chapter.id },
    });

    expect(course1Chapter).toBeNull();
    expect(course2Chapter).not.toBeNull();
    expect(existingChapter).not.toBeNull();
    expect(existingChapter?.id).toBe(chapter.id);
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

  test("closes gap in positions after removal", async () => {
    const [course, chapter1, chapter2, chapter3] = await Promise.all([
      courseFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    await Promise.all([
      courseChapterFixture({
        chapterId: chapter1.id,
        courseId: course.id,
        position: 0,
      }),
      courseChapterFixture({
        chapterId: chapter2.id,
        courseId: course.id,
        position: 1,
      }),
      courseChapterFixture({
        chapterId: chapter3.id,
        courseId: course.id,
        position: 2,
      }),
    ]);

    await removeChapterFromCourse({
      chapterId: chapter2.id,
      courseId: course.id,
      headers,
    });

    const chapters = await prisma.courseChapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: course.id },
    });

    expect(chapters.length).toBe(2);
    expect(chapters[0]?.chapterId).toBe(chapter1.id);
    expect(chapters[0]?.position).toBe(0);
    expect(chapters[1]?.chapterId).toBe(chapter3.id);
    expect(chapters[1]?.position).toBe(1);
  });

  test("removing last chapter does not affect others", async () => {
    const [course, chapter1, chapter2, chapter3] = await Promise.all([
      courseFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    await Promise.all([
      courseChapterFixture({
        chapterId: chapter1.id,
        courseId: course.id,
        position: 0,
      }),
      courseChapterFixture({
        chapterId: chapter2.id,
        courseId: course.id,
        position: 1,
      }),
      courseChapterFixture({
        chapterId: chapter3.id,
        courseId: course.id,
        position: 2,
      }),
    ]);

    await removeChapterFromCourse({
      chapterId: chapter3.id,
      courseId: course.id,
      headers,
    });

    const chapters = await prisma.courseChapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: course.id },
    });

    expect(chapters.length).toBe(2);
    expect(chapters[0]?.chapterId).toBe(chapter1.id);
    expect(chapters[0]?.position).toBe(0);
    expect(chapters[1]?.chapterId).toBe(chapter2.id);
    expect(chapters[1]?.position).toBe(1);
  });

  test("positions remain consecutive after multiple removals", async () => {
    const [course, chapter1, chapter2, chapter3, chapter4] = await Promise.all([
      courseFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    await Promise.all([
      courseChapterFixture({
        chapterId: chapter1.id,
        courseId: course.id,
        position: 0,
      }),
      courseChapterFixture({
        chapterId: chapter2.id,
        courseId: course.id,
        position: 1,
      }),
      courseChapterFixture({
        chapterId: chapter3.id,
        courseId: course.id,
        position: 2,
      }),
      courseChapterFixture({
        chapterId: chapter4.id,
        courseId: course.id,
        position: 3,
      }),
    ]);

    await removeChapterFromCourse({
      chapterId: chapter1.id,
      courseId: course.id,
      headers,
    });

    await removeChapterFromCourse({
      chapterId: chapter3.id,
      courseId: course.id,
      headers,
    });

    const chapters = await prisma.courseChapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: course.id },
    });

    expect(chapters.length).toBe(2);
    expect(chapters[0]?.chapterId).toBe(chapter2.id);
    expect(chapters[0]?.position).toBe(0);
    expect(chapters[1]?.chapterId).toBe(chapter4.id);
    expect(chapters[1]?.position).toBe(1);
  });

  test("handles concurrent removals without duplicate positions", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const chapters = await Promise.all(
      Array.from({ length: 5 }, () =>
        chapterFixture({ organizationId: organization.id }),
      ),
    );

    await Promise.all(
      chapters.map((chapter, index) =>
        courseChapterFixture({
          chapterId: chapter.id,
          courseId: course.id,
          position: index,
        }),
      ),
    );

    const results = await Promise.all(
      chapters.slice(0, 3).map((chapter) =>
        removeChapterFromCourse({
          chapterId: chapter.id,
          courseId: course.id,
          headers,
        }),
      ),
    );

    for (const result of results) {
      expect(result.error).toBeNull();
    }

    const courseChapters = await prisma.courseChapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: course.id },
    });

    expect(courseChapters.length).toBe(2);

    const positions = courseChapters.map((cc) => cc.position);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBe(2);

    const sortedPositions = [...positions].sort((a, b) => a - b);
    expect(sortedPositions).toEqual([0, 1]);
  });
});
