import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  getCourseIntroductionLessonsStep,
  getIntroductionLessonsStep,
} from "./get-introduction-lessons-step";

describe(getIntroductionLessonsStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("returns published lessons ordered by position", async () => {
    const course = await courseFixture({ organizationId });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId,
    });

    const [secondLesson, firstLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId,
        position: 1,
        title: "Second intro lesson",
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId,
        position: 0,
        title: "First intro lesson",
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: false,
        organizationId,
        position: 2,
        title: "Hidden intro lesson",
      }),
    ]);

    const result = await getIntroductionLessonsStep(chapter.id);

    expect(result.map((lesson) => lesson.id)).toStrictEqual([firstLesson.id, secondLesson.id]);
  });

  it("returns an empty list for a chapter without published lessons", async () => {
    const course = await courseFixture({ organizationId });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId,
    });

    await lessonFixture({
      chapterId: chapter.id,
      isPublished: false,
      organizationId,
      position: 0,
      title: "Hidden intro lesson",
    });

    const result = await getIntroductionLessonsStep(chapter.id);

    expect(result).toStrictEqual([]);
  });

  it("loads only the position-zero chapter lessons from the course context", async () => {
    const course = await courseFixture({ organizationId });

    const [introChapter, mainChapter] = await Promise.all([
      chapterFixture({ courseId: course.id, isPublished: true, organizationId, position: 0 }),
      chapterFixture({ courseId: course.id, isPublished: true, organizationId, position: 1 }),
    ]);

    const [secondIntroLesson, firstIntroLesson] = await Promise.all([
      lessonFixture({
        chapterId: introChapter.id,
        isPublished: true,
        organizationId,
        position: 1,
        title: "Second intro lesson",
      }),
      lessonFixture({
        chapterId: introChapter.id,
        isPublished: true,
        organizationId,
        position: 0,
        title: "First intro lesson",
      }),
      lessonFixture({
        chapterId: mainChapter.id,
        isPublished: true,
        organizationId,
        position: 0,
        title: "Main chapter lesson",
      }),
    ]);

    const result = await getCourseIntroductionLessonsStep(course.id);

    expect(result.map((lesson) => lesson.id)).toStrictEqual([
      firstIntroLesson.id,
      secondIntroLesson.id,
    ]);
  });
});
