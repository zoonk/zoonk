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

  let ch1Id: number;
  let ch1Slug: string;
  let ch2Id: number;
  let ch2Slug: string;

  let l1Id: number;
  let l1Slug: string;
  let l2Id: number;
  let l2Slug: string;
  let l3Id: number;
  let l3Slug: string;

  let a2Id: bigint;
  let a3Id: bigint;
  let a4Id: bigint;

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

    ch1Id = ch1.id;
    ch1Slug = ch1.slug;
    ch2Id = ch2.id;
    ch2Slug = ch2.slug;

    // Chapter 1: 2 lessons
    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({
        chapterId: ch1Id,
        isPublished: true,
        organizationId: orgId,
        position: 0,
      }),
      lessonFixture({
        chapterId: ch1Id,
        isPublished: true,
        organizationId: orgId,
        position: 1,
      }),
    ]);

    l1Id = lesson1.id;
    l1Slug = lesson1.slug;
    l2Id = lesson2.id;
    l2Slug = lesson2.slug;

    // Chapter 2: 1 lesson
    const lesson3 = await lessonFixture({
      chapterId: ch2Id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });

    l3Id = lesson3.id;
    l3Slug = lesson3.slug;

    // Lesson 1: activities at positions 0, 1
    // Lesson 2: activity at position 0
    // Lesson 3 (ch2): activity at position 0
    const [, act2, act3, act4] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: l1Id,
        organizationId: orgId,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: l1Id,
        organizationId: orgId,
        position: 1,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: l2Id,
        organizationId: orgId,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: l3Id,
        organizationId: orgId,
        position: 0,
      }),
    ]);

    a2Id = act2.id;
    a3Id = act3.id;
    a4Id = act4.id;
  });

  test("returns next activity in same lesson", async () => {
    const result = await getNextActivityInCourse({
      activityPosition: 0,
      chapterId: ch1Id,
      chapterPosition: 0,
      courseId,
      lessonId: l1Id,
      lessonPosition: 0,
    });

    expect(result).toMatchObject({
      activityId: a2Id,
      activityPosition: 1,
      chapterId: ch1Id,
      chapterSlug: ch1Slug,
      lessonId: l1Id,
      lessonSlug: l1Slug,
    });
  });

  test("returns first activity of next lesson when at last activity of current lesson", async () => {
    const result = await getNextActivityInCourse({
      activityPosition: 1,
      chapterId: ch1Id,
      chapterPosition: 0,
      courseId,
      lessonId: l1Id,
      lessonPosition: 0,
    });

    expect(result).toMatchObject({
      activityId: a3Id,
      activityPosition: 0,
      chapterId: ch1Id,
      chapterSlug: ch1Slug,
      lessonId: l2Id,
      lessonSlug: l2Slug,
    });
  });

  test("returns first activity of next chapter when at last lesson of current chapter", async () => {
    const result = await getNextActivityInCourse({
      activityPosition: 0,
      chapterId: ch1Id,
      chapterPosition: 0,
      courseId,
      lessonId: l2Id,
      lessonPosition: 1,
    });

    expect(result).toMatchObject({
      activityId: a4Id,
      activityPosition: 0,
      chapterId: ch2Id,
      chapterSlug: ch2Slug,
      lessonId: l3Id,
      lessonSlug: l3Slug,
    });
  });

  test("returns null when at the last activity of the course", async () => {
    const result = await getNextActivityInCourse({
      activityPosition: 0,
      chapterId: ch2Id,
      chapterPosition: 1,
      courseId,
      lessonId: l3Id,
      lessonPosition: 0,
    });

    expect(result).toBeNull();
  });

  test("returns null for a non-existent course", async () => {
    const result = await getNextActivityInCourse({
      activityPosition: 0,
      chapterId: ch1Id,
      chapterPosition: 0,
      courseId: 999_999,
      lessonId: l1Id,
      lessonPosition: 0,
    });

    expect(result).toBeNull();
  });

  test("includes activity kind and title in result", async () => {
    const result = await getNextActivityInCourse({
      activityPosition: 0,
      chapterId: ch1Id,
      chapterPosition: 0,
      courseId,
      lessonId: l1Id,
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
