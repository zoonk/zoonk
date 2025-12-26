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
import { reorderChapters } from "./reorder-chapters";

describe("unauthenticated users", async () => {
  const organization = await organizationFixture();
  const course = await courseFixture({ organizationId: organization.id });

  test("returns Forbidden", async () => {
    const result = await reorderChapters({
      chapters: [],
      courseId: course.id,
      headers: new Headers(),
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("members", async () => {
  const { organization, user } = await memberFixture({ role: "member" });
  const headers = await signInAs(user.email, user.password);
  const course = await courseFixture({ organizationId: organization.id });

  test("returns Forbidden", async () => {
    const result = await reorderChapters({
      chapters: [],
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
  const course = await courseFixture({ organizationId: organization.id });

  test("reorders chapters successfully", async () => {
    const chapter1 = await chapterFixture({ organizationId: organization.id });
    const chapter2 = await chapterFixture({ organizationId: organization.id });
    const chapter3 = await chapterFixture({ organizationId: organization.id });

    await courseChapterFixture({
      chapterId: chapter1.id,
      courseId: course.id,
      position: 0,
    });
    await courseChapterFixture({
      chapterId: chapter2.id,
      courseId: course.id,
      position: 1,
    });
    await courseChapterFixture({
      chapterId: chapter3.id,
      courseId: course.id,
      position: 2,
    });

    const result = await reorderChapters({
      chapters: [
        { chapterId: chapter3.id, position: 0 },
        { chapterId: chapter1.id, position: 1 },
        { chapterId: chapter2.id, position: 2 },
      ],
      courseId: course.id,
      headers,
    });

    const expectedUpdated = 3;

    expect(result.error).toBeNull();
    expect(result.data?.updated).toBe(expectedUpdated);

    const reorderedChapters = await prisma.courseChapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: course.id },
    });

    expect(reorderedChapters[0]?.chapterId).toBe(chapter3.id);
    expect(reorderedChapters[1]?.chapterId).toBe(chapter1.id);
    expect(reorderedChapters[2]?.chapterId).toBe(chapter2.id);
  });

  test("returns Course not found", async () => {
    const result = await reorderChapters({
      chapters: [],
      courseId: 999_999,
      headers,
    });

    expect(result.error?.message).toBe("Course not found");
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for course in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });

    const result = await reorderChapters({
      chapters: [],
      courseId: otherCourse.id,
      headers,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });

  test("handles empty chapters array", async () => {
    const result = await reorderChapters({
      chapters: [],
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.updated).toBe(0);
  });

  test("only updates chapters that exist in the course", async () => {
    const chapter = await chapterFixture({ organizationId: organization.id });
    await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      position: 0,
    });

    const expectedPosition = 5;

    const result = await reorderChapters({
      chapters: [
        { chapterId: chapter.id, position: expectedPosition },
        { chapterId: 999_999, position: 0 },
      ],
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.updated).toBe(1);

    const updatedChapter = await prisma.courseChapter.findFirst({
      where: { chapterId: chapter.id, courseId: course.id },
    });

    expect(updatedChapter?.position).toBe(expectedPosition);
  });
});

describe("owners", async () => {
  const { organization, user } = await memberFixture({ role: "owner" });
  const headers = await signInAs(user.email, user.password);
  const course = await courseFixture({ organizationId: organization.id });

  test("reorders chapters successfully", async () => {
    const chapter1 = await chapterFixture({ organizationId: organization.id });
    const chapter2 = await chapterFixture({ organizationId: organization.id });

    await courseChapterFixture({
      chapterId: chapter1.id,
      courseId: course.id,
      position: 0,
    });
    await courseChapterFixture({
      chapterId: chapter2.id,
      courseId: course.id,
      position: 1,
    });

    const result = await reorderChapters({
      chapters: [
        { chapterId: chapter2.id, position: 0 },
        { chapterId: chapter1.id, position: 1 },
      ],
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.updated).toBe(2);
  });
});
