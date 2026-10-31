import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { beforeEach, describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getCatalogLesson } from "./lesson";

describe(getCatalogLesson, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("reads a lesson its course's outline holds", async () => {
    const { course, lessons } = await catalogCourseFixture({ lessonCounts: [1] });
    const lesson = lessons[0]![0]!;

    await expect(
      getCatalogLesson({ courseId: course.id, lessonId: lesson.id }),
    ).resolves.toMatchObject({ id: lesson.id, title: lesson.title });
  });

  it("isn't found in a course that doesn't hold it, nor through an unpublished course", async () => {
    const [published, unpublished] = await Promise.all([
      catalogCourseFixture({ lessonCounts: [1] }),
      catalogCourseFixture({ isPublished: false, lessonCounts: [1] }),
    ]);

    const other = await courseFixture({ isPublished: true });

    await expect(
      Promise.all([
        getCatalogLesson({ courseId: other.id, lessonId: published.lessons[0]![0]!.id }),
        getCatalogLesson({
          courseId: unpublished.course.id,
          lessonId: unpublished.lessons[0]![0]!.id,
        }),
      ]),
    ).resolves.toStrictEqual([null, null]);
  });
});
