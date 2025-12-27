import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import {
  chapterAttrs,
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
import { createChapter } from "./create-chapter";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const result = await createChapter({
      ...chapterAttrs(),
      courseId: course.id,
      headers: new Headers(),
      position: 0,
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

    const result = await createChapter({
      ...chapterAttrs(),
      courseId: course.id,
      headers,
      position: 0,
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

  test("creates chapter successfully", async () => {
    const attrs = chapterAttrs();

    const result = await createChapter({
      ...attrs,
      courseId: course.id,
      headers,
      position: 0,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.chapter.title).toBe(attrs.title);
    expect(result.data?.chapter.description).toBe(attrs.description);
    expect(result.data?.chapter.organizationId).toBe(organization.id);
    expect(result.data?.courseChapterId).toBeDefined();
  });

  test("normalizes slug", async () => {
    const attrs = chapterAttrs();

    const result = await createChapter({
      ...attrs,
      courseId: course.id,
      headers,
      position: 0,
      slug: "My Test Chapter!",
    });

    expect(result.error).toBeNull();
    expect(result.data?.chapter.slug).toBe("my-test-chapter");
  });

  test("normalizes title for search", async () => {
    const attrs = chapterAttrs();

    const result = await createChapter({
      ...attrs,
      courseId: course.id,
      headers,
      position: 0,
      title: "Ciência da Computação",
    });

    expect(result.error).toBeNull();
    expect(result.data?.chapter.normalizedTitle).toBe("ciencia da computacao");
  });

  test("returns Course not found", async () => {
    const result = await createChapter({
      ...chapterAttrs(),
      courseId: 999_999,
      headers,
      position: 0,
    });

    expect(result.error?.message).toBe(ErrorCode.courseNotFound);
    expect(result.data).toBeNull();
  });

  test("don't allow to create chapter for a different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });

    const result = await createChapter({
      ...chapterAttrs(),
      courseId: otherCourse.id,
      headers,
      position: 0,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("returns error when slug already exists for same org", async () => {
    const attrs = chapterAttrs();

    await createChapter({
      ...attrs,
      courseId: course.id,
      headers,
      position: 0,
    });

    const result = await createChapter({
      ...attrs,
      courseId: course.id,
      headers,
      position: 1,
    });

    expect(result.error).not.toBeNull();
  });

  test("creates chapter at correct position", async () => {
    const attrs = chapterAttrs();
    const expectedPosition = 5;

    const result = await createChapter({
      ...attrs,
      courseId: course.id,
      headers,
      position: expectedPosition,
    });

    expect(result.error).toBeNull();

    const courseChapter = await prisma.courseChapter.findUnique({
      where: { id: result.data?.courseChapterId },
    });

    expect(courseChapter?.position).toBe(expectedPosition);
  });

  test("shifts existing chapters when creating at position 0", async () => {
    const newCourse = await courseFixture({ organizationId: organization.id });

    const [chapter1, chapter2] = await Promise.all([
      chapterFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    await Promise.all([
      courseChapterFixture({
        chapterId: chapter1.id,
        courseId: newCourse.id,
        position: 0,
      }),
      courseChapterFixture({
        chapterId: chapter2.id,
        courseId: newCourse.id,
        position: 1,
      }),
    ]);

    const result = await createChapter({
      ...chapterAttrs(),
      courseId: newCourse.id,
      headers,
      position: 0,
    });

    expect(result.error).toBeNull();

    const chapters = await prisma.courseChapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: newCourse.id },
    });

    expect(chapters.length).toBe(3);
    expect(chapters[0]?.chapterId).toBe(result.data?.chapter.id);
    expect(chapters[0]?.position).toBe(0);
    expect(chapters[1]?.chapterId).toBe(chapter1.id);
    expect(chapters[1]?.position).toBe(1);
    expect(chapters[2]?.chapterId).toBe(chapter2.id);
    expect(chapters[2]?.position).toBe(2);
  });

  test("shifts only chapters after insertion point", async () => {
    const newCourse = await courseFixture({ organizationId: organization.id });

    const [chapter1, chapter2, chapter3] = await Promise.all([
      chapterFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    await Promise.all([
      courseChapterFixture({
        chapterId: chapter1.id,
        courseId: newCourse.id,
        position: 0,
      }),
      courseChapterFixture({
        chapterId: chapter2.id,
        courseId: newCourse.id,
        position: 1,
      }),
      courseChapterFixture({
        chapterId: chapter3.id,
        courseId: newCourse.id,
        position: 2,
      }),
    ]);

    const result = await createChapter({
      ...chapterAttrs(),
      courseId: newCourse.id,
      headers,
      position: 1,
    });

    expect(result.error).toBeNull();

    const chapters = await prisma.courseChapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: newCourse.id },
    });

    expect(chapters.length).toBe(4);
    expect(chapters[0]?.chapterId).toBe(chapter1.id);
    expect(chapters[0]?.position).toBe(0);
    expect(chapters[1]?.chapterId).toBe(result.data?.chapter.id);
    expect(chapters[1]?.position).toBe(1);
    expect(chapters[2]?.chapterId).toBe(chapter2.id);
    expect(chapters[2]?.position).toBe(2);
    expect(chapters[3]?.chapterId).toBe(chapter3.id);
    expect(chapters[3]?.position).toBe(3);
  });

  test("does not shift chapters when creating at end", async () => {
    const newCourse = await courseFixture({ organizationId: organization.id });

    const [chapter1, chapter2] = await Promise.all([
      chapterFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    await Promise.all([
      courseChapterFixture({
        chapterId: chapter1.id,
        courseId: newCourse.id,
        position: 0,
      }),
      courseChapterFixture({
        chapterId: chapter2.id,
        courseId: newCourse.id,
        position: 1,
      }),
    ]);

    const result = await createChapter({
      ...chapterAttrs(),
      courseId: newCourse.id,
      headers,
      position: 2,
    });

    expect(result.error).toBeNull();

    const chapters = await prisma.courseChapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: newCourse.id },
    });

    expect(chapters.length).toBe(3);
    expect(chapters[0]?.chapterId).toBe(chapter1.id);
    expect(chapters[0]?.position).toBe(0);
    expect(chapters[1]?.chapterId).toBe(chapter2.id);
    expect(chapters[1]?.position).toBe(1);
    expect(chapters[2]?.chapterId).toBe(result.data?.chapter.id);
    expect(chapters[2]?.position).toBe(2);
  });

  test("handles concurrent creations at same position without duplicate positions", async () => {
    const newCourse = await courseFixture({ organizationId: organization.id });

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        createChapter({
          ...chapterAttrs(),
          courseId: newCourse.id,
          headers,
          position: 0,
        }),
      ),
    );

    for (const result of results) {
      expect(result.error).toBeNull();
    }

    const chapters = await prisma.courseChapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: newCourse.id },
    });

    expect(chapters.length).toBe(5);

    const positions = chapters.map((cc) => cc.position);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBe(5);

    const sortedPositions = [...positions].sort((a, b) => a - b);
    expect(sortedPositions).toEqual([0, 1, 2, 3, 4]);
  });
});
