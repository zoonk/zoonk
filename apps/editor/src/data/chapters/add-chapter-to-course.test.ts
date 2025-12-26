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
import { addChapterToCourse } from "./add-chapter-to-course";

describe("unauthenticated users", async () => {
  const organization = await organizationFixture();

  const [course, chapter] = await Promise.all([
    courseFixture({ organizationId: organization.id }),
    chapterFixture({ organizationId: organization.id }),
  ]);

  test("returns Forbidden", async () => {
    const result = await addChapterToCourse({
      chapterId: chapter.id,
      courseId: course.id,
      headers: new Headers(),
      position: 0,
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
    const result = await addChapterToCourse({
      chapterId: chapter.id,
      courseId: course.id,
      headers,
      position: 0,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("admins", async () => {
  const { organization, user } = await memberFixture({ role: "admin" });
  const headers = await signInAs(user.email, user.password);

  test("adds chapter to course successfully", async () => {
    const [course, chapter] = await Promise.all([
      courseFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    const result = await addChapterToCourse({
      chapterId: chapter.id,
      courseId: course.id,
      headers,
      position: 0,
    });

    expect(result.error).toBeNull();
    expect(result.data?.chapterId).toBe(chapter.id);
    expect(result.data?.courseId).toBe(course.id);
    expect(result.data?.position).toBe(0);
  });

  test("adds same chapter to multiple courses", async () => {
    const [course1, course2, chapter] = await Promise.all([
      courseFixture({ organizationId: organization.id }),
      courseFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    const [result1, result2] = await Promise.all([
      addChapterToCourse({
        chapterId: chapter.id,
        courseId: course1.id,
        headers,
        position: 0,
      }),
      addChapterToCourse({
        chapterId: chapter.id,
        courseId: course2.id,
        headers,
        position: 0,
      }),
    ]);

    expect(result1.error).toBeNull();
    expect(result2.error).toBeNull();
    expect(result1.data?.courseId).toBe(course1.id);
    expect(result2.data?.courseId).toBe(course2.id);

    const courseChapters = await prisma.courseChapter.findMany({
      where: { chapterId: chapter.id },
    });

    expect(courseChapters.length).toBe(2);
  });

  test("returns error when chapter already in course", async () => {
    const [course, chapter] = await Promise.all([
      courseFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      position: 0,
    });

    const result = await addChapterToCourse({
      chapterId: chapter.id,
      courseId: course.id,
      headers,
      position: 1,
    });

    expect(result.error).not.toBeNull();
    expect(result.data).toBeNull();

    const courseChapters = await prisma.courseChapter.findMany({
      where: { chapterId: chapter.id },
    });

    expect(courseChapters.length).toBe(1);
  });

  test("returns Course not found", async () => {
    const chapter = await chapterFixture({ organizationId: organization.id });

    const result = await addChapterToCourse({
      chapterId: chapter.id,
      courseId: 999_999,
      headers,
      position: 0,
    });

    expect(result.error?.message).toBe("Course not found");
    expect(result.data).toBeNull();
  });

  test("returns Chapter not found", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const result = await addChapterToCourse({
      chapterId: 999_999,
      courseId: course.id,
      headers,
      position: 0,
    });

    expect(result.error?.message).toBe("Chapter not found");
    expect(result.data).toBeNull();
  });

  test("returns error when chapter and course belong to different organizations", async () => {
    const [otherOrg, course] = await Promise.all([
      organizationFixture(),
      courseFixture({ organizationId: organization.id }),
    ]);

    const chapter = await chapterFixture({ organizationId: otherOrg.id });

    const result = await addChapterToCourse({
      chapterId: chapter.id,
      courseId: course.id,
      headers,
      position: 0,
    });

    expect(result.error?.message).toBe(
      "Chapter and course must belong to the same organization",
    );

    expect(result.data).toBeNull();
  });

  test("returns Forbidden for course in different organization", async () => {
    const otherOrg = await organizationFixture();

    const [course, chapter] = await Promise.all([
      courseFixture({ organizationId: otherOrg.id }),
      chapterFixture({ organizationId: otherOrg.id }),
    ]);

    const result = await addChapterToCourse({
      chapterId: chapter.id,
      courseId: course.id,
      headers,
      position: 0,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });

  test("shifts existing chapters when inserting at position 0", async () => {
    const [course, chapter1, chapter2, newChapter] = await Promise.all([
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
    ]);

    const result = await addChapterToCourse({
      chapterId: newChapter.id,
      courseId: course.id,
      headers,
      position: 0,
    });

    expect(result.error).toBeNull();
    expect(result.data?.position).toBe(0);

    const chapters = await prisma.courseChapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: course.id },
    });

    expect(chapters.length).toBe(3);
    expect(chapters[0]?.chapterId).toBe(newChapter.id);
    expect(chapters[0]?.position).toBe(0);
    expect(chapters[1]?.chapterId).toBe(chapter1.id);
    expect(chapters[1]?.position).toBe(1);
    expect(chapters[2]?.chapterId).toBe(chapter2.id);
    expect(chapters[2]?.position).toBe(2);
  });

  test("shifts only chapters after insertion point", async () => {
    const [course, chapter1, chapter2, chapter3, newChapter] =
      await Promise.all([
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
    ]);

    const result = await addChapterToCourse({
      chapterId: newChapter.id,
      courseId: course.id,
      headers,
      position: 1,
    });

    expect(result.error).toBeNull();
    expect(result.data?.position).toBe(1);

    const chapters = await prisma.courseChapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: course.id },
    });

    expect(chapters.length).toBe(4);
    expect(chapters[0]?.chapterId).toBe(chapter1.id);
    expect(chapters[0]?.position).toBe(0);
    expect(chapters[1]?.chapterId).toBe(newChapter.id);
    expect(chapters[1]?.position).toBe(1);
    expect(chapters[2]?.chapterId).toBe(chapter2.id);
    expect(chapters[2]?.position).toBe(2);
    expect(chapters[3]?.chapterId).toBe(chapter3.id);
    expect(chapters[3]?.position).toBe(3);
  });

  test("does not shift chapters when inserting at end", async () => {
    const [course, chapter1, chapter2, newChapter] = await Promise.all([
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
    ]);

    const result = await addChapterToCourse({
      chapterId: newChapter.id,
      courseId: course.id,
      headers,
      position: 2,
    });

    expect(result.error).toBeNull();
    expect(result.data?.position).toBe(2);

    const chapters = await prisma.courseChapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: course.id },
    });

    expect(chapters.length).toBe(3);
    expect(chapters[0]?.chapterId).toBe(chapter1.id);
    expect(chapters[0]?.position).toBe(0);
    expect(chapters[1]?.chapterId).toBe(chapter2.id);
    expect(chapters[1]?.position).toBe(1);
    expect(chapters[2]?.chapterId).toBe(newChapter.id);
    expect(chapters[2]?.position).toBe(2);
  });

  test("handles concurrent additions at same position without duplicate positions", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const chapters = await Promise.all(
      Array.from({ length: 5 }, () =>
        chapterFixture({ organizationId: organization.id }),
      ),
    );

    const results = await Promise.all(
      chapters.map((chapter) =>
        addChapterToCourse({
          chapterId: chapter.id,
          courseId: course.id,
          headers,
          position: 0,
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

    expect(courseChapters.length).toBe(5);

    const positions = courseChapters.map((cc) => cc.position);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBe(5);

    const sortedPositions = [...positions].sort((a, b) => a - b);
    expect(sortedPositions).toEqual([0, 1, 2, 3, 4]);
  });
});
