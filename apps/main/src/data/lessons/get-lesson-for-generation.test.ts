import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { getLessonForGeneration } from "./get-lesson-for-generation";

describe(getLessonForGeneration, () => {
  let organizationId: number;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
    });
  });

  test("returns lesson with chapter and course info", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
    });

    const result = await getLessonForGeneration(lesson.id);

    expect(result).toMatchObject({
      _count: {
        activities: 0,
      },
      chapter: {
        course: {
          slug: course.slug,
          title: course.title,
        },
        slug: chapter.slug,
        title: chapter.title,
      },
      description: lesson.description,
      generationRunId: lesson.generationRunId,
      generationStatus: lesson.generationStatus,
      id: lesson.id,
      language: lesson.language,
      organizationId: lesson.organizationId,
      position: lesson.position,
      slug: lesson.slug,
      title: lesson.title,
    });
  });

  test("returns null for non-existent lessons", async () => {
    const result = await getLessonForGeneration(999_999);

    expect(result).toBeNull();
  });

  test("returns null for lessons outside the AI organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      organizationId: otherOrg.id,
    });
    const otherLesson = await lessonFixture({
      chapterId: otherChapter.id,
      organizationId: otherOrg.id,
    });

    const result = await getLessonForGeneration(otherLesson.id);

    expect(result).toBeNull();
  });
});
