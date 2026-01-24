import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { getChapterForGeneration } from "./get-chapter-for-generation";

describe(getChapterForGeneration, () => {
  let organizationId: number;
  let course: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId });
  });

  test("returns chapter with course info", async () => {
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
    });

    const result = await getChapterForGeneration(chapter.id);

    expect(result).toMatchObject({
      _count: {
        lessons: 0,
      },
      course: {
        slug: course.slug,
        title: course.title,
      },
      description: chapter.description,
      generationRunId: chapter.generationRunId,
      generationStatus: chapter.generationStatus,
      id: chapter.id,
      language: chapter.language,
      organizationId: chapter.organizationId,
      title: chapter.title,
    });
  });

  test("returns lesson count when chapter has lessons", async () => {
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
    });

    await lessonFixture({
      chapterId: chapter.id,
      organizationId,
    });

    await lessonFixture({
      chapterId: chapter.id,
      organizationId,
    });

    const result = await getChapterForGeneration(chapter.id);

    expect(result?._count.lessons).toBe(2);
  });

  test("returns null for non-existent chapter", async () => {
    const result = await getChapterForGeneration(999_999);
    expect(result).toBeNull();
  });
});
