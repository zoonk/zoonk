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
});
