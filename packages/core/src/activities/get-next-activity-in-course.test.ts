import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { getNextActivityInCourse } from "./get-next-activity-in-course";

describe(getNextActivityInCourse, () => {
  let courseId: number;
  let orgId: number;

  let chapter1Id: number;
  let chapter1Slug: string;
  let chapter2Id: number;
  let chapter2Slug: string;

  let lesson1Id: number;
  let lesson1Slug: string;
  let lesson2Id: number;
  let lesson2Slug: string;
  let lesson3Id: number;
  let lesson3Slug: string;

  let activity2Id: bigint;
  let activity3Id: bigint;
  let activity4Id: bigint;

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
    lesson1Slug = lesson1.slug;
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

    // Lesson 1: activities at positions 0, 1
    // Lesson 2: activity at position 0
    // Lesson 3 (chapter 2): activity at position 0
    const [, act2, act3, act4] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson1Id,
        organizationId: orgId,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson1Id,
        organizationId: orgId,
        position: 1,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson2Id,
        organizationId: orgId,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson3Id,
        organizationId: orgId,
        position: 0,
      }),
    ]);

    activity2Id = act2.id;
    activity3Id = act3.id;
    activity4Id = act4.id;
  });

  test("returns next activity in same lesson", async () => {
    const result = await getNextActivityInCourse({
      activityPosition: 0,
      chapterId: chapter1Id,
      chapterPosition: 0,
      courseId,
      lessonId: lesson1Id,
      lessonPosition: 0,
    });

    expect(result).toMatchObject({
      activityId: activity2Id,
      activityPosition: 1,
      chapterId: chapter1Id,
      chapterSlug: chapter1Slug,
      lessonId: lesson1Id,
      lessonSlug: lesson1Slug,
    });
  });

  test("returns first activity of next lesson when at last activity of current lesson", async () => {
    const result = await getNextActivityInCourse({
      activityPosition: 1,
      chapterId: chapter1Id,
      chapterPosition: 0,
      courseId,
      lessonId: lesson1Id,
      lessonPosition: 0,
    });

    expect(result).toMatchObject({
      activityId: activity3Id,
      activityPosition: 0,
      chapterId: chapter1Id,
      chapterSlug: chapter1Slug,
      lessonId: lesson2Id,
      lessonSlug: lesson2Slug,
    });
  });

  test("returns first activity of next chapter when at last lesson of current chapter", async () => {
    const result = await getNextActivityInCourse({
      activityPosition: 0,
      chapterId: chapter1Id,
      chapterPosition: 0,
      courseId,
      lessonId: lesson2Id,
      lessonPosition: 1,
    });

    expect(result).toMatchObject({
      activityId: activity4Id,
      activityPosition: 0,
      chapterId: chapter2Id,
      chapterSlug: chapter2Slug,
      lessonId: lesson3Id,
      lessonSlug: lesson3Slug,
    });
  });

  test("returns null when at the last activity of the course", async () => {
    const result = await getNextActivityInCourse({
      activityPosition: 0,
      chapterId: chapter2Id,
      chapterPosition: 1,
      courseId,
      lessonId: lesson3Id,
      lessonPosition: 0,
    });

    expect(result).toBeNull();
  });

  test("returns null for a non-existent course", async () => {
    const result = await getNextActivityInCourse({
      activityPosition: 0,
      chapterId: chapter1Id,
      chapterPosition: 0,
      courseId: 999_999,
      lessonId: lesson1Id,
      lessonPosition: 0,
    });

    expect(result).toBeNull();
  });

  test("includes activity kind and title in result", async () => {
    const result = await getNextActivityInCourse({
      activityPosition: 0,
      chapterId: chapter1Id,
      chapterPosition: 0,
      courseId,
      lessonId: lesson1Id,
      lessonPosition: 0,
    });

    expect(result).toHaveProperty("activityKind");
    expect(result).toHaveProperty("activityTitle");
    expect(result).toHaveProperty("lessonTitle");
    expect(result).toHaveProperty("lessonDescription");
  });

  test("skips unpublished activities", async () => {
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
    const testLesson = await lessonFixture({
      chapterId: testChapter.id,
      isPublished: true,
      organizationId: testOrg.id,
      position: 0,
    });

    const activities = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: testLesson.id,
        organizationId: testOrg.id,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: false,
        lessonId: testLesson.id,
        organizationId: testOrg.id,
        position: 1,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: testLesson.id,
        organizationId: testOrg.id,
        position: 2,
      }),
    ]);

    const thirdActivity = activities[2];

    const result = await getNextActivityInCourse({
      activityPosition: 0,
      chapterId: testChapter.id,
      chapterPosition: 0,
      courseId: testCourse.id,
      lessonId: testLesson.id,
      lessonPosition: 0,
    });

    expect(result).toMatchObject({
      activityId: thirdActivity?.id,
      activityPosition: 2,
      chapterSlug: testChapter.slug,
      lessonSlug: testLesson.slug,
    });
  });

  test("skips activities with incomplete generation", async () => {
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
    const testLesson = await lessonFixture({
      chapterId: testChapter.id,
      isPublished: true,
      organizationId: testOrg.id,
      position: 0,
    });

    const pendingActivities = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: testLesson.id,
        organizationId: testOrg.id,
        position: 0,
      }),
      activityFixture({
        generationStatus: "pending",
        isPublished: true,
        lessonId: testLesson.id,
        organizationId: testOrg.id,
        position: 1,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: testLesson.id,
        organizationId: testOrg.id,
        position: 2,
      }),
    ]);

    const thirdActivity = pendingActivities[2];

    const result = await getNextActivityInCourse({
      activityPosition: 0,
      chapterId: testChapter.id,
      chapterPosition: 0,
      courseId: testCourse.id,
      lessonId: testLesson.id,
      lessonPosition: 0,
    });

    expect(result).toMatchObject({
      activityId: thirdActivity?.id,
      activityPosition: 2,
      chapterSlug: testChapter.slug,
      lessonSlug: testLesson.slug,
    });
  });

  test("skips activities in unpublished lessons", async () => {
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

    const [publishedLesson, unpublishedLesson, nextPublishedLesson] = await Promise.all([
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

    const activityResults = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: publishedLesson.id,
        organizationId: testOrg.id,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: unpublishedLesson.id,
        organizationId: testOrg.id,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: nextPublishedLesson.id,
        organizationId: testOrg.id,
        position: 0,
      }),
    ]);

    const nextActivity = activityResults[2];

    const result = await getNextActivityInCourse({
      activityPosition: 0,
      chapterId: testChapter.id,
      chapterPosition: 0,
      courseId: testCourse.id,
      lessonId: publishedLesson.id,
      lessonPosition: 0,
    });

    expect(result).toMatchObject({
      activityId: nextActivity?.id,
      activityPosition: 0,
      chapterSlug: testChapter.slug,
      lessonSlug: nextPublishedLesson.slug,
    });
  });

  test("skips activities in unpublished chapters", async () => {
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

    const [lesson1, lesson2, lesson3] = await Promise.all([
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

    const activityResults = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson1.id,
        organizationId: testOrg.id,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson2.id,
        organizationId: testOrg.id,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson3.id,
        organizationId: testOrg.id,
        position: 0,
      }),
    ]);

    const nextActivity = activityResults[2];

    const result = await getNextActivityInCourse({
      activityPosition: 0,
      chapterId: publishedCh.id,
      chapterPosition: 0,
      courseId: testCourse.id,
      lessonId: lesson1.id,
      lessonPosition: 0,
    });

    expect(result).toMatchObject({
      activityId: nextActivity?.id,
      activityPosition: 0,
      chapterSlug: nextPublishedCh.slug,
      lessonSlug: lesson3.slug,
    });
  });
});
