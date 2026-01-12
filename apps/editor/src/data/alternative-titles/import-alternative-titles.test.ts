import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { importAlternativeTitles } from "./import-alternative-titles";

function createMockFile(
  content: string,
  name = "alternative-titles.json",
  type = "application/json",
): File {
  return new File([content], name, { type });
}

function createImportFile(alternativeTitles: string[]): File {
  return createMockFile(JSON.stringify({ alternativeTitles }));
}

describe("importAlternativeTitles", () => {
  test("imports titles successfully", async () => {
    const suffix = randomUUID().slice(0, 8);
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const file = createImportFile([
      `Machine Learning ${suffix}`,
      `ML Basics ${suffix}`,
    ]);

    const result = await importAlternativeTitles({
      courseId: course.id,
      file,
      language: "en",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data).toContain(`machine-learning-${suffix}`);
    expect(result.data).toContain(`ml-basics-${suffix}`);

    const titles = await prisma.courseAlternativeTitle.findMany({
      orderBy: { slug: "asc" },
      select: { slug: true },
      where: { courseId: course.id },
    });

    expect(titles).toHaveLength(2);
  });

  test("returns courseNotFound for non-existent course", async () => {
    const suffix = randomUUID().slice(0, 8);
    const file = createImportFile([`Test Title ${suffix}`]);

    const result = await importAlternativeTitles({
      courseId: 999_999,
      file,
      language: "en",
    });

    expect(result.error?.message).toBe(ErrorCode.courseNotFound);
    expect(result.data).toBeNull();
  });

  test("merge mode adds new titles and skips duplicates", async () => {
    const suffix = randomUUID().slice(0, 8);
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    await prisma.courseAlternativeTitle.create({
      data: {
        courseId: course.id,
        language: "en",
        slug: `existing-title-${suffix}`,
      },
    });

    const file = createImportFile([
      `Existing Title ${suffix}`,
      `New Title ${suffix}`,
    ]);

    const result = await importAlternativeTitles({
      courseId: course.id,
      file,
      language: "en",
    });

    expect(result.error).toBeNull();

    const titles = await prisma.courseAlternativeTitle.findMany({
      orderBy: { slug: "asc" },
      select: { slug: true },
      where: { courseId: course.id },
    });

    expect(titles).toHaveLength(2);
    expect(titles).toContainEqual({ slug: `existing-title-${suffix}` });
    expect(titles).toContainEqual({ slug: `new-title-${suffix}` });
  });

  test("replace mode removes existing titles", async () => {
    const suffix = randomUUID().slice(0, 8);
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    await prisma.courseAlternativeTitle.create({
      data: {
        courseId: course.id,
        language: "en",
        slug: `old-title-${suffix}`,
      },
    });

    const file = createImportFile([`New Title ${suffix}`]);

    const result = await importAlternativeTitles({
      courseId: course.id,
      file,
      language: "en",
      mode: "replace",
    });

    expect(result.error).toBeNull();

    const titles = await prisma.courseAlternativeTitle.findMany({
      select: { slug: true },
      where: { courseId: course.id },
    });

    expect(titles).toHaveLength(1);
    expect(titles[0]?.slug).toBe(`new-title-${suffix}`);
  });

  test("replace mode only removes titles for the specified language", async () => {
    const suffix = randomUUID().slice(0, 8);
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    await prisma.courseAlternativeTitle.createMany({
      data: [
        {
          courseId: course.id,
          language: "en",
          slug: `english-title-${suffix}`,
        },
        {
          courseId: course.id,
          language: "pt",
          slug: `portuguese-title-${suffix}`,
        },
      ],
    });

    const file = createImportFile([`New English Title ${suffix}`]);

    const result = await importAlternativeTitles({
      courseId: course.id,
      file,
      language: "en",
      mode: "replace",
    });

    expect(result.error).toBeNull();

    const allTitles = await prisma.courseAlternativeTitle.findMany({
      orderBy: { language: "asc" },
      select: { language: true, slug: true },
      where: { courseId: course.id },
    });

    expect(allTitles).toHaveLength(2);

    expect(allTitles).toContainEqual({
      language: "en",
      slug: `new-english-title-${suffix}`,
    });

    expect(allTitles).toContainEqual({
      language: "pt",
      slug: `portuguese-title-${suffix}`,
    });
  });

  test("handles duplicate titles within import file", async () => {
    const suffix = randomUUID().slice(0, 8);
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const file = createImportFile([
      `Same Title ${suffix}`,
      `Same Title ${suffix}`,
      `SAME TITLE ${suffix}`,
      `Different Title ${suffix}`,
    ]);

    const result = await importAlternativeTitles({
      courseId: course.id,
      file,
      language: "en",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);

    const titles = await prisma.courseAlternativeTitle.findMany({
      select: { slug: true },
      where: { courseId: course.id },
    });

    expect(titles).toHaveLength(2);
  });

  test("returns empty array when all titles are empty", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const file = createMockFile(JSON.stringify({ alternativeTitles: [] }));

    const result = await importAlternativeTitles({
      courseId: course.id,
      file,
      language: "en",
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  describe("file validation", () => {
    test("rejects file larger than 5MB", async () => {
      const organization = await organizationFixture();
      const course = await courseFixture({ organizationId: organization.id });

      const largeContent = "x".repeat(6 * 1024 * 1024);
      const file = createMockFile(largeContent);

      const result = await importAlternativeTitles({
        courseId: course.id,
        file,
        language: "en",
      });

      expect(result.error?.message).toBe(ErrorCode.fileTooLarge);
    });

    test("rejects non-JSON file", async () => {
      const organization = await organizationFixture();
      const course = await courseFixture({ organizationId: organization.id });

      const file = new File(["test content"], "titles.txt", {
        type: "text/plain",
      });

      const result = await importAlternativeTitles({
        courseId: course.id,
        file,
        language: "en",
      });

      expect(result.error?.message).toBe(ErrorCode.invalidFileType);
    });

    test("rejects invalid JSON", async () => {
      const organization = await organizationFixture();
      const course = await courseFixture({ organizationId: organization.id });

      const file = createMockFile("{ invalid json }");

      const result = await importAlternativeTitles({
        courseId: course.id,
        file,
        language: "en",
      });

      expect(result.error?.message).toBe(ErrorCode.invalidJsonFormat);
    });

    test("rejects JSON without alternativeTitles array", async () => {
      const organization = await organizationFixture();
      const course = await courseFixture({ organizationId: organization.id });

      const file = createMockFile(JSON.stringify({ foo: "bar" }));

      const result = await importAlternativeTitles({
        courseId: course.id,
        file,
        language: "en",
      });

      expect(result.error?.message).toBe(
        ErrorCode.invalidAlternativeTitleFormat,
      );
    });

    test("rejects non-string titles", async () => {
      const organization = await organizationFixture();
      const course = await courseFixture({ organizationId: organization.id });

      const file = createMockFile(
        JSON.stringify({
          alternativeTitles: [123, "Valid Title"],
        }),
      );

      const result = await importAlternativeTitles({
        courseId: course.id,
        file,
        language: "en",
      });

      expect(result.error?.message).toBe(
        ErrorCode.invalidAlternativeTitleFormat,
      );
    });

    test("rejects empty string titles", async () => {
      const organization = await organizationFixture();
      const course = await courseFixture({ organizationId: organization.id });

      const file = createMockFile(
        JSON.stringify({
          alternativeTitles: ["", "Valid Title"],
        }),
      );

      const result = await importAlternativeTitles({
        courseId: course.id,
        file,
        language: "en",
      });

      expect(result.error?.message).toBe(
        ErrorCode.invalidAlternativeTitleFormat,
      );
    });

    test("rejects whitespace-only titles", async () => {
      const organization = await organizationFixture();
      const course = await courseFixture({ organizationId: organization.id });

      const file = createMockFile(
        JSON.stringify({
          alternativeTitles: ["   ", "Valid Title"],
        }),
      );

      const result = await importAlternativeTitles({
        courseId: course.id,
        file,
        language: "en",
      });

      expect(result.error?.message).toBe(
        ErrorCode.invalidAlternativeTitleFormat,
      );
    });

    test("accepts JSON file by name when type is empty", async () => {
      const suffix = randomUUID().slice(0, 8);
      const organization = await organizationFixture();
      const course = await courseFixture({ organizationId: organization.id });

      const file = new File(
        [JSON.stringify({ alternativeTitles: [`Test Title ${suffix}`] })],
        "titles.json",
        { type: "" },
      );

      const result = await importAlternativeTitles({
        courseId: course.id,
        file,
        language: "en",
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
    });
  });
});
