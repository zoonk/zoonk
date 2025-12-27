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
import { importChapters } from "./import-chapters";

function createMockFile(
  content: string,
  name = "chapters.json",
  type = "application/json",
): File {
  return new File([content], name, { type });
}

function createImportFile(
  chapters: Array<{ description: string; slug?: string; title: string }>,
): File {
  return createMockFile(JSON.stringify({ chapters }));
}

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const file = createImportFile([{ description: "Desc", title: "Test" }]);

    const result = await importChapters({
      courseId: course.id,
      file,
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

    const file = createImportFile([{ description: "Desc", title: "Test" }]);

    const result = await importChapters({
      courseId: course.id,
      file,
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

  test("imports chapters successfully", async () => {
    const newCourse = await courseFixture({
      organizationId: organization.id,
    });

    const file = createImportFile([
      { description: "First Description", title: "First Chapter" },
      { description: "Second Description", title: "Second Chapter" },
    ]);

    const result = await importChapters({
      courseId: newCourse.id,
      file,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data?.[0]?.chapter.title).toBe("First Chapter");
    expect(result.data?.[1]?.chapter.title).toBe("Second Chapter");

    const chapters = await prisma.courseChapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: newCourse.id },
    });

    expect(chapters).toHaveLength(2);
    expect(chapters[0]?.chapterId).toBe(result.data?.[0]?.chapter.id);
    expect(chapters[0]?.position).toBe(0);
    expect(chapters[1]?.position).toBe(1);
  });

  test("returns Course not found for non-existent course", async () => {
    const file = createImportFile([{ description: "Desc", title: "Test" }]);

    const result = await importChapters({
      courseId: 999_999,
      file,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.courseNotFound);
    expect(result.data).toBeNull();
  });

  test("don't allow importing chapters to a different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });

    const file = createImportFile([{ description: "Desc", title: "Test" }]);

    const result = await importChapters({
      courseId: otherCourse.id,
      file,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("appends to existing chapters", async () => {
    const newCourse = await courseFixture({
      organizationId: organization.id,
    });

    const existingChapter = await chapterFixture({
      organizationId: organization.id,
      title: "Existing",
    });

    await courseChapterFixture({
      chapterId: existingChapter.id,
      courseId: newCourse.id,
      position: 0,
    });

    const file = createImportFile([{ description: "Desc", title: "Imported" }]);

    const result = await importChapters({
      courseId: newCourse.id,
      file,
      headers,
    });

    expect(result.error).toBeNull();

    const chapters = await prisma.courseChapter.findMany({
      include: { chapter: true },
      orderBy: { position: "asc" },
      where: { courseId: newCourse.id },
    });

    expect(chapters).toHaveLength(2);
    expect(chapters[0]?.chapterId).toBe(existingChapter.id);
    expect(chapters[1]?.chapter.title).toBe("Imported");
  });

  test("generates slug from title", async () => {
    const newCourse = await courseFixture({
      organizationId: organization.id,
    });

    const file = createImportFile([
      { description: "Desc", title: "My Test Chapter!" },
    ]);

    const result = await importChapters({
      courseId: newCourse.id,
      file,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.[0]?.chapter.slug).toBe("my-test-chapter");
  });

  test("normalizes chapter title for search", async () => {
    const newCourse = await courseFixture({
      organizationId: organization.id,
    });

    const file = createImportFile([
      { description: "Desc", title: "Ciência da Computação" },
    ]);

    const result = await importChapters({
      courseId: newCourse.id,
      file,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.[0]?.chapter.normalizedTitle).toBe(
      "ciencia da computacao",
    );
  });

  test("assigns positions in order", async () => {
    const newCourse = await courseFixture({
      organizationId: organization.id,
    });

    const file = createImportFile([
      { description: "Desc 1", title: "First" },
      { description: "Desc 2", title: "Second" },
      { description: "Desc 3", title: "Third" },
    ]);

    const result = await importChapters({
      courseId: newCourse.id,
      file,
      headers,
    });

    expect(result.error).toBeNull();

    const chapters = await prisma.courseChapter.findMany({
      include: { chapter: true },
      orderBy: { position: "asc" },
      where: { courseId: newCourse.id },
    });

    expect(chapters).toHaveLength(3);
    expect(chapters[0]?.position).toBe(0);
    expect(chapters[0]?.chapter.title).toBe("First");
    expect(chapters[1]?.position).toBe(1);
    expect(chapters[1]?.chapter.title).toBe("Second");
    expect(chapters[2]?.position).toBe(2);
    expect(chapters[2]?.chapter.title).toBe("Third");
  });

  describe("slug handling", () => {
    test("uses explicit slug when it doesn't exist", async () => {
      const newCourse = await courseFixture({
        organizationId: organization.id,
      });

      const file = createImportFile([
        { description: "Desc", slug: "my-custom-slug", title: "Test" },
      ]);

      const result = await importChapters({
        courseId: newCourse.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data?.[0]?.chapter.slug).toBe("my-custom-slug");
    });

    test("reuses existing chapter when explicit slug matches", async () => {
      const newCourse = await courseFixture({
        organizationId: organization.id,
      });

      const existingChapter = await chapterFixture({
        description: "Original description",
        organizationId: organization.id,
        slug: "existing-chapter",
        title: "Original Title",
      });

      const file = createImportFile([
        {
          description: "New description",
          slug: "existing-chapter",
          title: "New Title",
        },
      ]);

      const result = await importChapters({
        courseId: newCourse.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data?.[0]?.chapter.id).toBe(existingChapter.id);
      expect(result.data?.[0]?.chapter.title).toBe("Original Title");
      expect(result.data?.[0]?.chapter.description).toBe(
        "Original description",
      );
    });

    test("adds existing chapter to course without creating new one", async () => {
      const course1 = await courseFixture({
        organizationId: organization.id,
      });

      const course2 = await courseFixture({
        organizationId: organization.id,
      });

      const existingChapter = await chapterFixture({
        organizationId: organization.id,
        slug: "shared-chapter",
        title: "Shared Chapter",
      });

      await courseChapterFixture({
        chapterId: existingChapter.id,
        courseId: course1.id,
        position: 0,
      });

      const file = createImportFile([
        {
          description: "Desc",
          slug: "shared-chapter",
          title: "Different Title",
        },
      ]);

      const result = await importChapters({
        courseId: course2.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data?.[0]?.chapter.id).toBe(existingChapter.id);

      const chaptersInCourse2 = await prisma.courseChapter.findMany({
        where: { courseId: course2.id },
      });

      expect(chaptersInCourse2).toHaveLength(1);
      expect(chaptersInCourse2[0]?.chapterId).toBe(existingChapter.id);

      const allChaptersWithSlug = await prisma.chapter.findMany({
        where: { organizationId: organization.id, slug: "shared-chapter" },
      });

      expect(allChaptersWithSlug).toHaveLength(1);
    });

    test("appends timestamp when generated slug exists and no explicit slug", async () => {
      const newCourse = await courseFixture({
        organizationId: organization.id,
      });

      await chapterFixture({
        organizationId: organization.id,
        slug: "my-title",
      });

      const file = createImportFile([
        { description: "Desc", title: "My Title" },
      ]);

      const result = await importChapters({
        courseId: newCourse.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data?.[0]?.chapter.slug).toMatch(/^my-title-\d+-0$/);
    });

    test("creates new chapter when generated slug doesn't exist", async () => {
      const newCourse = await courseFixture({
        organizationId: organization.id,
      });

      const file = createImportFile([
        { description: "Desc", title: "Unique Title" },
      ]);

      const result = await importChapters({
        courseId: newCourse.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data?.[0]?.chapter.slug).toBe("unique-title");
    });

    test("handles duplicate titles within the same batch", async () => {
      const newCourse = await courseFixture({
        organizationId: organization.id,
      });

      const file = createImportFile([
        { description: "First introduction", title: "Introduction" },
        { description: "Second introduction", title: "Introduction" },
        { description: "Third introduction", title: "Introduction" },
      ]);

      const result = await importChapters({
        courseId: newCourse.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(3);

      const slugs = result.data?.map((item) => item.chapter.slug) ?? [];
      const uniqueSlugs = new Set(slugs);

      expect(uniqueSlugs.size).toBe(3);
      expect(slugs[0]).toBe("introduction");
      expect(slugs[1]).toMatch(/^introduction-\d+-1$/);
      expect(slugs[2]).toMatch(/^introduction-\d+-2$/);
    });

    test("handles duplicate explicit slugs within the same batch", async () => {
      const newCourse = await courseFixture({
        organizationId: organization.id,
      });

      const file = createImportFile([
        { description: "First", slug: "same-slug", title: "Chapter 1" },
        { description: "Second", slug: "same-slug", title: "Chapter 2" },
      ]);

      const result = await importChapters({
        courseId: newCourse.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(2);

      const slugs = result.data?.map((item) => item.chapter.slug) ?? [];
      const uniqueSlugs = new Set(slugs);

      expect(uniqueSlugs.size).toBe(2);
    });
  });

  describe("replace mode", () => {
    test("removes existing chapters and adds new ones", async () => {
      const newCourse = await courseFixture({
        organizationId: organization.id,
      });

      const existingChapter = await chapterFixture({
        organizationId: organization.id,
        title: "Existing",
      });

      await courseChapterFixture({
        chapterId: existingChapter.id,
        courseId: newCourse.id,
        position: 0,
      });

      const file = createImportFile([
        { description: "Desc", title: "New Chapter" },
      ]);

      const result = await importChapters({
        courseId: newCourse.id,
        file,
        headers,
        mode: "replace",
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]?.chapter.title).toBe("New Chapter");

      const chapters = await prisma.courseChapter.findMany({
        include: { chapter: true },
        where: { courseId: newCourse.id },
      });

      expect(chapters).toHaveLength(1);
      expect(chapters[0]?.chapter.title).toBe("New Chapter");
    });

    test("starts positions from 0 after replace", async () => {
      const newCourse = await courseFixture({
        organizationId: organization.id,
      });

      const existingChapter = await chapterFixture({
        organizationId: organization.id,
      });

      await courseChapterFixture({
        chapterId: existingChapter.id,
        courseId: newCourse.id,
        position: 5,
      });

      const file = createImportFile([
        { description: "Desc 1", title: "First" },
        { description: "Desc 2", title: "Second" },
      ]);

      const result = await importChapters({
        courseId: newCourse.id,
        file,
        headers,
        mode: "replace",
      });

      expect(result.error).toBeNull();

      const chapters = await prisma.courseChapter.findMany({
        orderBy: { position: "asc" },
        where: { courseId: newCourse.id },
      });

      expect(chapters).toHaveLength(2);
      expect(chapters[0]?.position).toBe(0);
      expect(chapters[1]?.position).toBe(1);
    });

    test("deletes chapters not linked to other courses", async () => {
      const newCourse = await courseFixture({
        organizationId: organization.id,
      });

      const chapterToDelete = await chapterFixture({
        organizationId: organization.id,
        title: "To Delete",
      });

      await courseChapterFixture({
        chapterId: chapterToDelete.id,
        courseId: newCourse.id,
        position: 0,
      });

      const file = createImportFile([{ description: "Desc", title: "New" }]);

      await importChapters({
        courseId: newCourse.id,
        file,
        headers,
        mode: "replace",
      });

      const deletedChapter = await prisma.chapter.findUnique({
        where: { id: chapterToDelete.id },
      });

      expect(deletedChapter).toBeNull();
    });

    test("keeps chapters linked to other courses", async () => {
      const course1 = await courseFixture({
        organizationId: organization.id,
      });

      const course2 = await courseFixture({
        organizationId: organization.id,
      });

      const sharedChapter = await chapterFixture({
        organizationId: organization.id,
        title: "Shared",
      });

      await Promise.all([
        courseChapterFixture({
          chapterId: sharedChapter.id,
          courseId: course1.id,
          position: 0,
        }),
        courseChapterFixture({
          chapterId: sharedChapter.id,
          courseId: course2.id,
          position: 0,
        }),
      ]);

      const file = createImportFile([{ description: "Desc", title: "New" }]);

      await importChapters({
        courseId: course1.id,
        file,
        headers,
        mode: "replace",
      });

      const keptChapter = await prisma.chapter.findUnique({
        where: { id: sharedChapter.id },
      });

      expect(keptChapter).not.toBeNull();
      expect(keptChapter?.title).toBe("Shared");

      const course2Chapters = await prisma.courseChapter.findMany({
        where: { courseId: course2.id },
      });

      expect(course2Chapters).toHaveLength(1);
      expect(course2Chapters[0]?.chapterId).toBe(sharedChapter.id);
    });

    test("works with empty course", async () => {
      const newCourse = await courseFixture({
        organizationId: organization.id,
      });

      const file = createImportFile([
        { description: "Desc", title: "New Chapter" },
      ]);

      const result = await importChapters({
        courseId: newCourse.id,
        file,
        headers,
        mode: "replace",
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
    });
  });

  describe("file validation", () => {
    test("rejects file larger than 5MB", async () => {
      const largeContent = "x".repeat(6 * 1024 * 1024);
      const file = createMockFile(largeContent);

      const result = await importChapters({
        courseId: course.id,
        file,
        headers,
      });

      expect(result.error?.message).toBe(ErrorCode.fileTooLarge);
    });

    test("rejects non-JSON file", async () => {
      const file = new File(["test content"], "chapters.txt", {
        type: "text/plain",
      });

      const result = await importChapters({
        courseId: course.id,
        file,
        headers,
      });

      expect(result.error?.message).toBe(ErrorCode.invalidFileType);
    });

    test("rejects invalid JSON", async () => {
      const file = createMockFile("{ invalid json }");

      const result = await importChapters({
        courseId: course.id,
        file,
        headers,
      });

      expect(result.error?.message).toBe(ErrorCode.invalidJsonFormat);
    });

    test("rejects JSON without chapters array", async () => {
      const file = createMockFile(JSON.stringify({ foo: "bar" }));

      const result = await importChapters({
        courseId: course.id,
        file,
        headers,
      });

      expect(result.error?.message).toBe(ErrorCode.invalidChapterFormat);
    });

    test("rejects chapter without title", async () => {
      const file = createMockFile(
        JSON.stringify({
          chapters: [{ description: "Desc" }],
        }),
      );

      const result = await importChapters({
        courseId: course.id,
        file,
        headers,
      });

      expect(result.error?.message).toBe(ErrorCode.invalidChapterFormat);
    });

    test("rejects chapter with empty title", async () => {
      const file = createMockFile(
        JSON.stringify({
          chapters: [{ description: "Desc", title: "" }],
        }),
      );

      const result = await importChapters({
        courseId: course.id,
        file,
        headers,
      });

      expect(result.error?.message).toBe(ErrorCode.invalidChapterFormat);
    });

    test("rejects chapter without description", async () => {
      const file = createMockFile(
        JSON.stringify({
          chapters: [{ title: "Test" }],
        }),
      );

      const result = await importChapters({
        courseId: course.id,
        file,
        headers,
      });

      expect(result.error?.message).toBe(ErrorCode.invalidChapterFormat);
    });

    test("accepts JSON file by name when type is empty", async () => {
      const newCourse = await courseFixture({
        organizationId: organization.id,
      });

      const file = new File(
        [
          JSON.stringify({
            chapters: [{ description: "Desc", title: "Test" }],
          }),
        ],
        "chapters.json",
        { type: "" },
      );

      const result = await importChapters({
        courseId: newCourse.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
    });
  });
});
