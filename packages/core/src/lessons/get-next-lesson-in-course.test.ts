import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { getNextLessonInCourse } from "./get-next-lesson-in-course";

describe(getNextLessonInCourse, () => {
  let courseId: string;
  let orgId: string;

  let chapter1Id: string;
  let chapter1Slug: string;
  let chapter2Id: string;
  let chapter2Slug: string;

  let lesson1Id: string;
  let lesson2Id: string;
  let lesson2Slug: string;
  let lesson3Id: string;
  let lesson3Slug: string;

  beforeAll(async () => {
    const org = await organizationFixture({ kind: "brand" });
    orgId = org.id;

    const course = await courseFixture({
      isPublished: true,
      organizationId: orgId,
    });
    courseId = course.id;

    const [ch1, ch2] = await Promise.all([
      chapterFixture({
        courseId,
        isPublished: true,
        organizationId: orgId,
        position: 0,
      }),
      chapterFixture({
        courseId,
        isPublished: true,
        organizationId: orgId,
        position: 1,
      }),
    ]);

    chapter1Id = ch1.id;
    chapter1Slug = ch1.slug;
    chapter2Id = ch2.id;
    chapter2Slug = ch2.slug;

    // Chapter 1: 2 lessons
    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({
        chapterId: chapter1Id,
        isPublished: true,
        organizationId: orgId,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter1Id,
        isPublished: true,
        organizationId: orgId,
        position: 1,
      }),
    ]);

    lesson1Id = lesson1.id;
    lesson2Id = lesson2.id;
    lesson2Slug = lesson2.slug;

    // Chapter 2: 1 lesson
    const lesson3 = await lessonFixture({
      chapterId: chapter2Id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });

    lesson3Id = lesson3.id;
    lesson3Slug = lesson3.slug;
  });

  test("returns next lesson in same chapter", async () => {
    const result = await getNextLessonInCourse({
      chapterId: chapter1Id,
      chapterPosition: 0,
      courseId,
      lessonId: lesson1Id,
      lessonPosition: 0,
    });

    expect(result).toMatchObject({
      chapterId: chapter1Id,
      chapterSlug: chapter1Slug,
      lessonId: lesson2Id,
      lessonSlug: lesson2Slug,
    });
  });

  test("returns first lesson of next chapter when at last lesson of current chapter", async () => {
    const result = await getNextLessonInCourse({
      chapterId: chapter1Id,
      chapterPosition: 0,
      courseId,
      lessonId: lesson2Id,
      lessonPosition: 1,
    });

    expect(result).toMatchObject({
      chapterId: chapter2Id,
      chapterSlug: chapter2Slug,
      lessonId: lesson3Id,
      lessonSlug: lesson3Slug,
    });
  });

  test("returns null when at the last lesson of the course", async () => {
    const result = await getNextLessonInCourse({
      chapterId: chapter2Id,
      chapterPosition: 1,
      courseId,
      lessonId: lesson3Id,
      lessonPosition: 0,
    });

    expect(result).toBeNull();
  });

  test("returns null for a non-existent course", async () => {
    const result = await getNextLessonInCourse({
      chapterId: chapter1Id,
      chapterPosition: 0,
      courseId: "missing-course-id",
      lessonId: lesson1Id,
      lessonPosition: 0,
    });

    expect(result).toBeNull();
  });

  test("includes lesson kind and title in result", async () => {
    const result = await getNextLessonInCourse({
      chapterId: chapter1Id,
      chapterPosition: 0,
      courseId,
      lessonId: lesson1Id,
      lessonPosition: 0,
    });

    expect(result).toHaveProperty("lessonKind");
    expect(result).toHaveProperty("lessonTitle");
    expect(result).toHaveProperty("lessonTitle");
    expect(result).toHaveProperty("lessonDescription");
  });

  test("skips unpublished lessons", async () => {
    const testOrg = await organizationFixture({ kind: "brand" });
    const testCourse = await courseFixture({
      isPublished: true,
      organizationId: testOrg.id,
    });
    const testChapter = await chapterFixture({
      courseId: testCourse.id,
      isPublished: true,
      organizationId: testOrg.id,
      position: 0,
    });
    const lessons = await Promise.all([
      lessonFixture({
        chapterId: testChapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: testChapter.id,
        generationStatus: "completed",
        isPublished: false,
        organizationId: testOrg.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: testChapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: testOrg.id,
        position: 2,
      }),
    ]);

    const thirdLesson = lessons[2];

    const result = await getNextLessonInCourse({
      chapterId: testChapter.id,
      chapterPosition: 0,
      courseId: testCourse.id,
      lessonId: lessons[0]?.id ?? "",
      lessonPosition: 0,
    });

    expect(result).toMatchObject({
      chapterSlug: testChapter.slug,
      lessonId: thirdLesson?.id,
      lessonPosition: 2,
      lessonSlug: thirdLesson?.slug,
    });
  });

  test("skips lessons with incomplete generation", async () => {
    const testOrg = await organizationFixture({ kind: "brand" });
    const testCourse = await courseFixture({
      isPublished: true,
      organizationId: testOrg.id,
    });
    const testChapter = await chapterFixture({
      courseId: testCourse.id,
      isPublished: true,
      organizationId: testOrg.id,
      position: 0,
    });
    const pendingLessons = await Promise.all([
      lessonFixture({
        chapterId: testChapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: testChapter.id,
        generationStatus: "pending",
        isPublished: true,
        organizationId: testOrg.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: testChapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: testOrg.id,
        position: 2,
      }),
    ]);

    const thirdLesson = pendingLessons[2];

    const result = await getNextLessonInCourse({
      chapterId: testChapter.id,
      chapterPosition: 0,
      courseId: testCourse.id,
      lessonId: pendingLessons[0]?.id ?? "",
      lessonPosition: 0,
    });

    expect(result).toMatchObject({
      chapterSlug: testChapter.slug,
      lessonId: thirdLesson?.id,
      lessonPosition: 2,
      lessonSlug: thirdLesson?.slug,
    });
  });

  test("skips unpublished lessons when moving through a chapter", async () => {
    const testOrg = await organizationFixture({ kind: "brand" });
    const testCourse = await courseFixture({
      isPublished: true,
      organizationId: testOrg.id,
    });
    const testChapter = await chapterFixture({
      courseId: testCourse.id,
      isPublished: true,
      organizationId: testOrg.id,
      position: 0,
    });

    const [publishedLesson, _unpublishedLesson, nextPublishedLesson] = await Promise.all([
      lessonFixture({
        chapterId: testChapter.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: testChapter.id,
        isPublished: false,
        organizationId: testOrg.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: testChapter.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 2,
      }),
    ]);

    const result = await getNextLessonInCourse({
      chapterId: testChapter.id,
      chapterPosition: 0,
      courseId: testCourse.id,
      lessonId: publishedLesson.id,
      lessonPosition: 0,
    });

    expect(result).toMatchObject({
      chapterSlug: testChapter.slug,
      lessonId: nextPublishedLesson.id,
      lessonPosition: 2,
      lessonSlug: nextPublishedLesson.slug,
    });
  });

  test("skips lessons in unpublished chapters", async () => {
    const testOrg = await organizationFixture({ kind: "brand" });
    const testCourse = await courseFixture({
      isPublished: true,
      organizationId: testOrg.id,
    });

    const [publishedCh, unpublishedCh, nextPublishedCh] = await Promise.all([
      chapterFixture({
        courseId: testCourse.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
      chapterFixture({
        courseId: testCourse.id,
        isPublished: false,
        organizationId: testOrg.id,
        position: 1,
      }),
      chapterFixture({
        courseId: testCourse.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 2,
      }),
    ]);

    const [lesson1, _lesson2, lesson3] = await Promise.all([
      lessonFixture({
        chapterId: publishedCh.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: unpublishedCh.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: nextPublishedCh.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
    ]);

    const result = await getNextLessonInCourse({
      chapterId: publishedCh.id,
      chapterPosition: 0,
      courseId: testCourse.id,
      lessonId: lesson1.id,
      lessonPosition: 0,
    });

    expect(result).toMatchObject({
      chapterSlug: nextPublishedCh.slug,
      lessonId: lesson3.id,
      lessonPosition: 0,
      lessonSlug: lesson3.slug,
    });
  });
});
