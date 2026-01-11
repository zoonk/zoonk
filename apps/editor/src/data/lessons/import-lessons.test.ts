import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
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
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
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
    const course = await courseFixture({ organizationId: organization.id });

    const [headers, chapter] = await Promise.all([
      signInAs(user.email, user.password),
      chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      }),
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
    const course = await courseFixture({
      organizationId: fixture.organization.id,
    });

    [headers, chapter] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: fixture.organization.id,
      }),
    ]);
  });

  test("imports lessons successfully", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const newChapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
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
    expect(result.data?.[0]?.title).toBe("First Lesson");
    expect(result.data?.[1]?.title).toBe("Second Lesson");

    const lessons = await prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: newChapter.id },
    });

    expect(lessons).toHaveLength(2);
    expect(lessons[0]?.id).toBe(result.data?.[0]?.id);
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
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });

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
    const course = await courseFixture({ organizationId: organization.id });
    const newChapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    await lessonFixture({
      chapterId: newChapter.id,
      language: newChapter.language,
      organizationId: organization.id,
      position: 0,
      title: "Existing",
    });

    const file = createImportFile([{ description: "Desc", title: "Imported" }]);

    const result = await importLessons({
      chapterId: newChapter.id,
      file,
      headers,
    });

    expect(result.error).toBeNull();

    const lessons = await prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: newChapter.id },
    });

    expect(lessons).toHaveLength(2);
    expect(lessons[0]?.title).toBe("Existing");
    expect(lessons[1]?.title).toBe("Imported");
  });

  test("generates slug from title", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const newChapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
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
    expect(result.data?.[0]?.slug).toBe("my-test-lesson");
  });

  test("normalizes lesson title for search", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const newChapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const file = createImportFile([
      { description: "Desc", title: "Introdução à Programação" },
    ]);

    const result = await importLessons({
      chapterId: newChapter.id,
      file,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.[0]?.normalizedTitle).toBe("introducao a programacao");
  });

  test("assigns positions in order", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const newChapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
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

    const lessons = await prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: newChapter.id },
    });

    expect(lessons).toHaveLength(3);
    expect(lessons[0]?.position).toBe(0);
    expect(lessons[0]?.title).toBe("First");
    expect(lessons[1]?.position).toBe(1);
    expect(lessons[1]?.title).toBe("Second");
    expect(lessons[2]?.position).toBe(2);
    expect(lessons[2]?.title).toBe("Third");
  });

  describe("slug handling", () => {
    test("uses explicit slug when it doesn't exist", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const newChapter = await chapterFixture({
        courseId: course.id,
        language: course.language,
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
      expect(result.data?.[0]?.slug).toBe("my-custom-slug");
    });

    test("reuses existing lesson when explicit slug matches", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const newChapter = await chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      });

      const existingLesson = await lessonFixture({
        chapterId: newChapter.id,
        description: "Original description",
        language: newChapter.language,
        organizationId: organization.id,
        position: 0,
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
      expect(result.data?.[0]?.id).toBe(existingLesson.id);
      expect(result.data?.[0]?.title).toBe("Original Title");
      expect(result.data?.[0]?.description).toBe("Original description");
    });
  });

  describe("replace mode", () => {
    test("removes existing lessons and adds new ones", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const newChapter = await chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      });

      await lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 0,
        title: "Existing",
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
      expect(result.data?.[0]?.title).toBe("New Lesson");

      const lessons = await prisma.lesson.findMany({
        where: { chapterId: newChapter.id },
      });

      expect(lessons).toHaveLength(1);
      expect(lessons[0]?.title).toBe("New Lesson");
    });

    test("starts positions from 0 after replace", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const newChapter = await chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      });

      await lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
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

      const lessons = await prisma.lesson.findMany({
        orderBy: { position: "asc" },
        where: { chapterId: newChapter.id },
      });

      expect(lessons).toHaveLength(2);
      expect(lessons[0]?.position).toBe(0);
      expect(lessons[1]?.position).toBe(1);
    });

    test("works with empty chapter", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const newChapter = await chapterFixture({
        courseId: course.id,
        language: course.language,
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
      const course = await courseFixture({ organizationId: organization.id });
      const newChapter = await chapterFixture({
        courseId: course.id,
        language: course.language,
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

  describe("isPublished behavior", () => {
    test("imported lessons are published when chapter is unpublished", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const unpublishedChapter = await chapterFixture({
        courseId: course.id,
        isPublished: false,
        language: course.language,
        organizationId: organization.id,
      });

      const file = createImportFile([
        { description: "Desc", title: "Test Lesson" },
      ]);

      const result = await importLessons({
        chapterId: unpublishedChapter.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data?.[0]?.isPublished).toBe(true);
    });

    test("imported lessons are unpublished when chapter is published", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const publishedChapter = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        language: course.language,
        organizationId: organization.id,
      });

      const file = createImportFile([
        { description: "Desc", title: "Test Lesson" },
      ]);

      const result = await importLessons({
        chapterId: publishedChapter.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data?.[0]?.isPublished).toBe(false);
    });

    test("existing lesson becomes published when imported to unpublished chapter", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const unpublishedChapter = await chapterFixture({
        courseId: course.id,
        isPublished: false,
        language: course.language,
        organizationId: organization.id,
      });

      const existingLesson = await lessonFixture({
        chapterId: unpublishedChapter.id,
        isPublished: false,
        language: unpublishedChapter.language,
        organizationId: organization.id,
        position: 0,
        slug: "existing-slug",
      });

      const file = createImportFile([
        { description: "Desc", slug: "existing-slug", title: "Test" },
      ]);

      const result = await importLessons({
        chapterId: unpublishedChapter.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();

      const updatedLesson = await prisma.lesson.findUnique({
        where: { id: existingLesson.id },
      });

      expect(updatedLesson?.isPublished).toBe(true);
    });
  });

  describe("generationStatus behavior", () => {
    test("sets chapter generationStatus to completed after importing", async () => {
      const course = await courseFixture({ organizationId: organization.id });

      const newChapter = await chapterFixture({
        courseId: course.id,
        generationStatus: "pending",
        language: course.language,
        organizationId: organization.id,
      });

      const file = createImportFile([
        { description: "Desc", title: "Test Lesson" },
      ]);

      const result = await importLessons({
        chapterId: newChapter.id,
        file,
        headers,
      });

      expect(result.error).toBeNull();

      const updatedChapter = await prisma.chapter.findUnique({
        where: { id: newChapter.id },
      });

      expect(updatedChapter?.generationStatus).toBe("completed");
    });
  });
});
