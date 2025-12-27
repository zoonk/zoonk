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
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { reorderChapters } from "./reorder-chapters";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const result = await reorderChapters({
      chapters: [],
      courseId: course.id,
      headers: new Headers(),
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });

    const [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({ organizationId: organization.id }),
    ]);

    const result = await reorderChapters({
      chapters: [],
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;
  let course: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;

    [headers, course] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      courseFixture({ organizationId: fixture.organization.id }),
    ]);
  });

  test("reorders chapters successfully", async () => {
    const [chapter1, chapter2, chapter3] = await Promise.all([
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

    const result = await reorderChapters({
      chapters: [
        { chapterId: chapter3.id, position: 0 },
        { chapterId: chapter1.id, position: 1 },
        { chapterId: chapter2.id, position: 2 },
      ],
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.updated).toBe(3);

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

    expect(result.error?.message).toBe(ErrorCode.courseNotFound);
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

    expect(result.error?.message).toBe(ErrorCode.forbidden);
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
