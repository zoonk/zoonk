import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import {
  chapterLessonFixture,
  lessonFixture,
} from "@zoonk/testing/fixtures/lessons";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { importLessons } from "./import-lessons";

function createMockFile(
  content: string,
  name = "lessons.json",
  type = "application/json",
): File {
  return new File([content], name, { type });
}

function createImportFile(
  lessons: Array<{ description: string; slug?: string; title: string }>,
): File {
  return createMockFile(JSON.stringify({ lessons }));
}

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const chapter = await chapterFixture({ organizationId: organization.id });
    const file = createImportFile([{ description: "Desc", title: "Test" }]);

    const result = await importLessons({
      chapterId: chapter.id,
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

    const [headers, chapter] = await Promise.all([
      signInAs(user.email, user.password),
      chapterFixture({ organizationId: organization.id }),
    ]);

    const file = createImportFile([{ description: "Desc", title: "Test" }]);

    const result = await importLessons({
      chapterId: chapter.id,
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
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;

    [headers, chapter] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      chapterFixture({ organizationId: fixture.organization.id }),
    ]);
  });

  test("imports lessons successfully", async () => {
    const newChapter = await chapterFixture({
      organizationId: organization.id,
    });

    const file = createImportFile([
      { description: "First Description", title: "First Lesson" },
      { description: "Second Description", title: "Second Lesson" },
    ]);

    const result = await importLessons({
      chapterId: newChapter.id,
      file,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data?.[0]?.lesson.title).toBe("First Lesson");
    expect(result.data?.[1]?.lesson.title).toBe("Second Lesson");

    const lessons = await prisma.chapterLesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: newChapter.id },
    });

    expect(lessons).toHaveLength(2);
    expect(lessons[0]?.lessonId).toBe(result.data?.[0]?.lesson.id);
    expect(lessons[0]?.position).toBe(0);
    expect(lessons[1]?.position).toBe(1);
  });

  test("returns Chapter not found for non-existent chapter", async () => {
    const file = createImportFile([{ description: "Desc", title: "Test" }]);

    const result = await importLessons({
      chapterId: 999_999,
      file,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.chapterNotFound);
    expect(result.data).toBeNull();
  });

  test("don't allow importing lessons to a different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherChapter = await chapterFixture({ organizationId: otherOrg.id });

    const file = createImportFile([{ description: "Desc", title: "Test" }]);

    const result = await importLessons({
      chapterId: otherChapter.id,
      file,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("appends to existing lessons", async () => {
    const newChapter = await chapterFixture({
      organizationId: organization.id,
    });

    const existingLesson = await lessonFixture({
      organizationId: organization.id,
      title: "Existing",
    });

    await chapterLessonFixture({
      chapterId: newChapter.id,
      lessonId: existingLesson.id,
      position: 0,
    });

    const file = createImportFile([{ description: "Desc", title: "Imported" }]);

    const result = await importLessons({
      chapterId: newChapter.id,
      file,
      headers,
    });

    expect(result.error).toBeNull();

    const lessons = await prisma.chapterLesson.findMany({
      include: { lesson: true },
      orderBy: { position: "asc" },
      where: { chapterId: newChapter.id },
    });

    expect(lessons).toHaveLength(2);
    expect(lessons[0]?.lessonId).toBe(existingLesson.id);
    expect(lessons[1]?.lesson.title).toBe("Imported");
  });

  test("generates slug from title", async () => {
    const newChapter = await chapterFixture({
      organizationId: organization.id,
    });

    const file = createImportFile([
      { description: "Desc", title: "My Test Lesson!" },
    ]);

    const result = await importLessons({
      chapterId: newChapter.id,
      file,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.[0]?.lesson.slug).toBe("my-test-lesson");
  });

  test("normalizes lesson title for search", async () => {
    const newChapter = await chapterFixture({
      organizationId: organization.id,
    });

    const file = createImportFile([
      { description: "Desc", title: "Ciência da Computação" },
    ]);

    const result = await importLessons({
      chapterId: newChapter.id,
      file,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.[0]?.lesson.normalizedTitle).toBe(
      "ciencia da computacao",
    );
  });

  test("assigns positions in order", async () => {
    const newChapter = await chapterFixture({
      organizationId: organization.id,
    });

    const file = createImportFile([
      { description: "Desc 1", title: "First" },
      { description: "Desc 2", title: "Second" },
      { description: "Desc 3", title: "Third" },
    ]);

    const result = await importLessons({
      chapterId: newChapter.id,
      file,
      headers,
    });

    expect(result.error).toBeNull();

    const lessons = await prisma.chapterLesson.findMany({
      include: { lesson: true },
      orderBy: { position: "asc" },
      where: { chapterId: newChapter.id },
    });

    expect(lessons).toHaveLength(3);
    expect(lessons[0]?.position).toBe(0);
    expect(lessons[0]?.lesson.title).toBe("First");
    expect(lessons[1]?.position).toBe(1);
    expect(lessons[1]?.lesson.title).toBe("Second");
    expect(lessons[2]?.position).toBe(2);
    expect(lessons[2]?.lesson.title).toBe("Third");
  });

  describe("slug handling", () => {
    test("uses explicit slug when it doesn't exist", async () => {
      const newChapter = await chapterFixture({
        organizationId: organization.id,
      });

      const file = createImportFile([
        { description: "Desc", slug: "my-custom-slug", title: "Test" },
      ]);

      const result = await importLessons({
        chapterId: newChapter.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data?.[0]?.lesson.slug).toBe("my-custom-slug");
    });

    test("reuses existing lesson when explicit slug matches", async () => {
      const newChapter = await chapterFixture({
        organizationId: organization.id,
      });

      const existingLesson = await lessonFixture({
        description: "Original description",
        organizationId: organization.id,
        slug: "existing-lesson",
        title: "Original Title",
      });

      const file = createImportFile([
        {
          description: "New description",
          slug: "existing-lesson",
          title: "New Title",
        },
      ]);

      const result = await importLessons({
        chapterId: newChapter.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data?.[0]?.lesson.id).toBe(existingLesson.id);
      expect(result.data?.[0]?.lesson.title).toBe("Original Title");
      expect(result.data?.[0]?.lesson.description).toBe("Original description");
    });

    test("adds existing lesson to chapter without creating new one", async () => {
      const chapter1 = await chapterFixture({
        organizationId: organization.id,
      });

      const chapter2 = await chapterFixture({
        organizationId: organization.id,
      });

      const existingLesson = await lessonFixture({
        organizationId: organization.id,
        slug: "shared-lesson",
        title: "Shared Lesson",
      });

      await chapterLessonFixture({
        chapterId: chapter1.id,
        lessonId: existingLesson.id,
        position: 0,
      });

      const file = createImportFile([
        {
          description: "Desc",
          slug: "shared-lesson",
          title: "Different Title",
        },
      ]);

      const result = await importLessons({
        chapterId: chapter2.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data?.[0]?.lesson.id).toBe(existingLesson.id);

      const lessonsInChapter2 = await prisma.chapterLesson.findMany({
        where: { chapterId: chapter2.id },
      });

      expect(lessonsInChapter2).toHaveLength(1);
      expect(lessonsInChapter2[0]?.lessonId).toBe(existingLesson.id);

      const allLessonsWithSlug = await prisma.lesson.findMany({
        where: { organizationId: organization.id, slug: "shared-lesson" },
      });

      expect(allLessonsWithSlug).toHaveLength(1);
    });

    test("appends timestamp when generated slug exists and no explicit slug", async () => {
      const newChapter = await chapterFixture({
        organizationId: organization.id,
      });

      await lessonFixture({
        organizationId: organization.id,
        slug: "my-title",
      });

      const file = createImportFile([
        { description: "Desc", title: "My Title" },
      ]);

      const result = await importLessons({
        chapterId: newChapter.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data?.[0]?.lesson.slug).toMatch(/^my-title-\d+-0$/);
    });

    test("creates new lesson when generated slug doesn't exist", async () => {
      const newChapter = await chapterFixture({
        organizationId: organization.id,
      });

      const file = createImportFile([
        { description: "Desc", title: "Unique Title" },
      ]);

      const result = await importLessons({
        chapterId: newChapter.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data?.[0]?.lesson.slug).toBe("unique-title");
    });

    test("handles duplicate titles within the same batch", async () => {
      const newChapter = await chapterFixture({
        organizationId: organization.id,
      });

      const file = createImportFile([
        { description: "First introduction", title: "Introduction" },
        { description: "Second introduction", title: "Introduction" },
        { description: "Third introduction", title: "Introduction" },
      ]);

      const result = await importLessons({
        chapterId: newChapter.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(3);

      const slugs = result.data?.map((item) => item.lesson.slug) ?? [];
      const uniqueSlugs = new Set(slugs);

      expect(uniqueSlugs.size).toBe(3);
      expect(slugs[0]).toBe("introduction");
      expect(slugs[1]).toMatch(/^introduction-\d+-1$/);
      expect(slugs[2]).toMatch(/^introduction-\d+-2$/);
    });

    test("handles duplicate explicit slugs within the same batch", async () => {
      const newChapter = await chapterFixture({
        organizationId: organization.id,
      });

      const file = createImportFile([
        { description: "First", slug: "same-slug", title: "Lesson 1" },
        { description: "Second", slug: "same-slug", title: "Lesson 2" },
      ]);

      const result = await importLessons({
        chapterId: newChapter.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(2);

      const slugs = result.data?.map((item) => item.lesson.slug) ?? [];
      const uniqueSlugs = new Set(slugs);

      expect(uniqueSlugs.size).toBe(2);
    });
  });

  describe("replace mode", () => {
    test("removes existing lessons and adds new ones", async () => {
      const newChapter = await chapterFixture({
        organizationId: organization.id,
      });

      const existingLesson = await lessonFixture({
        organizationId: organization.id,
        title: "Existing",
      });

      await chapterLessonFixture({
        chapterId: newChapter.id,
        lessonId: existingLesson.id,
        position: 0,
      });

      const file = createImportFile([
        { description: "Desc", title: "New Lesson" },
      ]);

      const result = await importLessons({
        chapterId: newChapter.id,
        file,
        headers,
        mode: "replace",
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]?.lesson.title).toBe("New Lesson");

      const lessons = await prisma.chapterLesson.findMany({
        include: { lesson: true },
        where: { chapterId: newChapter.id },
      });

      expect(lessons).toHaveLength(1);
      expect(lessons[0]?.lesson.title).toBe("New Lesson");
    });

    test("starts positions from 0 after replace", async () => {
      const newChapter = await chapterFixture({
        organizationId: organization.id,
      });

      const existingLesson = await lessonFixture({
        organizationId: organization.id,
      });

      await chapterLessonFixture({
        chapterId: newChapter.id,
        lessonId: existingLesson.id,
        position: 5,
      });

      const file = createImportFile([
        { description: "Desc 1", title: "First" },
        { description: "Desc 2", title: "Second" },
      ]);

      const result = await importLessons({
        chapterId: newChapter.id,
        file,
        headers,
        mode: "replace",
      });

      expect(result.error).toBeNull();

      const lessons = await prisma.chapterLesson.findMany({
        orderBy: { position: "asc" },
        where: { chapterId: newChapter.id },
      });

      expect(lessons).toHaveLength(2);
      expect(lessons[0]?.position).toBe(0);
      expect(lessons[1]?.position).toBe(1);
    });

    test("deletes lessons not linked to other chapters", async () => {
      const newChapter = await chapterFixture({
        organizationId: organization.id,
      });

      const lessonToDelete = await lessonFixture({
        organizationId: organization.id,
        title: "To Delete",
      });

      await chapterLessonFixture({
        chapterId: newChapter.id,
        lessonId: lessonToDelete.id,
        position: 0,
      });

      const file = createImportFile([{ description: "Desc", title: "New" }]);

      await importLessons({
        chapterId: newChapter.id,
        file,
        headers,
        mode: "replace",
      });

      const deletedLesson = await prisma.lesson.findUnique({
        where: { id: lessonToDelete.id },
      });

      expect(deletedLesson).toBeNull();
    });

    test("keeps lessons linked to other chapters", async () => {
      const chapter1 = await chapterFixture({
        organizationId: organization.id,
      });

      const chapter2 = await chapterFixture({
        organizationId: organization.id,
      });

      const sharedLesson = await lessonFixture({
        organizationId: organization.id,
        title: "Shared",
      });

      await Promise.all([
        chapterLessonFixture({
          chapterId: chapter1.id,
          lessonId: sharedLesson.id,
          position: 0,
        }),
        chapterLessonFixture({
          chapterId: chapter2.id,
          lessonId: sharedLesson.id,
          position: 0,
        }),
      ]);

      const file = createImportFile([{ description: "Desc", title: "New" }]);

      await importLessons({
        chapterId: chapter1.id,
        file,
        headers,
        mode: "replace",
      });

      const keptLesson = await prisma.lesson.findUnique({
        where: { id: sharedLesson.id },
      });

      expect(keptLesson).not.toBeNull();
      expect(keptLesson?.title).toBe("Shared");

      const chapter2Lessons = await prisma.chapterLesson.findMany({
        where: { chapterId: chapter2.id },
      });

      expect(chapter2Lessons).toHaveLength(1);
      expect(chapter2Lessons[0]?.lessonId).toBe(sharedLesson.id);
    });

    test("works with empty chapter", async () => {
      const newChapter = await chapterFixture({
        organizationId: organization.id,
      });

      const file = createImportFile([
        { description: "Desc", title: "New Lesson" },
      ]);

      const result = await importLessons({
        chapterId: newChapter.id,
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

      const result = await importLessons({
        chapterId: chapter.id,
        file,
        headers,
      });

      expect(result.error?.message).toBe(ErrorCode.fileTooLarge);
    });

    test("rejects non-JSON file", async () => {
      const file = new File(["test content"], "lessons.txt", {
        type: "text/plain",
      });

      const result = await importLessons({
        chapterId: chapter.id,
        file,
        headers,
      });

      expect(result.error?.message).toBe(ErrorCode.invalidFileType);
    });

    test("rejects invalid JSON", async () => {
      const file = createMockFile("{ invalid json }");

      const result = await importLessons({
        chapterId: chapter.id,
        file,
        headers,
      });

      expect(result.error?.message).toBe(ErrorCode.invalidJsonFormat);
    });

    test("rejects JSON without lessons array", async () => {
      const file = createMockFile(JSON.stringify({ foo: "bar" }));

      const result = await importLessons({
        chapterId: chapter.id,
        file,
        headers,
      });

      expect(result.error?.message).toBe(ErrorCode.invalidLessonFormat);
    });

    test("rejects lesson without title", async () => {
      const file = createMockFile(
        JSON.stringify({
          lessons: [{ description: "Desc" }],
        }),
      );

      const result = await importLessons({
        chapterId: chapter.id,
        file,
        headers,
      });

      expect(result.error?.message).toBe(ErrorCode.invalidLessonFormat);
    });

    test("rejects lesson with empty title", async () => {
      const file = createMockFile(
        JSON.stringify({
          lessons: [{ description: "Desc", title: "" }],
        }),
      );

      const result = await importLessons({
        chapterId: chapter.id,
        file,
        headers,
      });

      expect(result.error?.message).toBe(ErrorCode.invalidLessonFormat);
    });

    test("rejects lesson without description", async () => {
      const file = createMockFile(
        JSON.stringify({
          lessons: [{ title: "Test" }],
        }),
      );

      const result = await importLessons({
        chapterId: chapter.id,
        file,
        headers,
      });

      expect(result.error?.message).toBe(ErrorCode.invalidLessonFormat);
    });

    test("accepts JSON file by name when type is empty", async () => {
      const newChapter = await chapterFixture({
        organizationId: organization.id,
      });

      const file = new File(
        [
          JSON.stringify({
            lessons: [{ description: "Desc", title: "Test" }],
          }),
        ],
        "lessons.json",
        { type: "" },
      );

      const result = await importLessons({
        chapterId: newChapter.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
    });
  });
});
