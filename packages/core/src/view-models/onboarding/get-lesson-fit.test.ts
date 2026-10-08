import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { describe, expect, it } from "vitest";
import { getLessonFit } from "./get-lesson-fit";

/** A published course of two chapters with one lesson each. */
async function createTwoChapterCourse() {
  const course = await courseFixture({ isPublished: true });

  const [first, later] = await Promise.all([
    libraryChapterFixture({ homeCourseId: course.id }),
    libraryChapterFixture({ homeCourseId: course.id }),
  ]);

  const [firstLesson, laterLesson] = await Promise.all([
    libraryLessonFixture({ homeChapterId: first.id }),
    libraryLessonFixture({ homeChapterId: later.id }),
  ]);

  await Promise.all([
    courseChapterFixture({ chapterId: first.id, courseId: course.id, position: 0 }),
    courseChapterFixture({ chapterId: later.id, courseId: course.id, position: 1 }),
    chapterLessonFixture({ chapterId: first.id, lessonId: firstLesson.id, position: 0 }),
    chapterLessonFixture({ chapterId: later.id, lessonId: laterLesson.id, position: 0 }),
  ]);

  return { course, firstLesson, later, laterLesson };
}

describe(getLessonFit, () => {
  it("starts the course from its beginning after a lesson in its first chapter", async () => {
    const { course, firstLesson } = await createTwoChapterCourse();

    await expect(getLessonFit({ lessonId: firstLesson.id })).resolves.toMatchObject({
      course: { chapterCount: 2, id: course.id, startChapterId: null },
    });
  });

  it("starts the course at a later chapter after a lesson in it", async () => {
    const { course, later, laterLesson } = await createTwoChapterCourse();

    await expect(getLessonFit({ lessonId: laterLesson.id })).resolves.toMatchObject({
      chapter: { id: later.id, lessonCount: 1, lessonNumber: 1 },
      course: { chapterCount: 2, id: course.id, startChapterId: later.id },
    });
  });
});
