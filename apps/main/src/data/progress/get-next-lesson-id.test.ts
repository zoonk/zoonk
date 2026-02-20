import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { getNextLessonId } from "./get-next-lesson-id";

describe(getNextLessonId, () => {
  let orgId: number;
  let courseId: number;

  let chapter1Id: number;
  let chapter2Id: number;

  let lesson1Id: number;
  let lesson2Id: number;
  let lesson3Id: number;

  let activity1Id: bigint;
  let activity2Id: bigint;
  let activity3Id: bigint;

  beforeAll(async () => {
    const org = await organizationFixture({ kind: "brand" });
    orgId = org.id;

    const course = await courseFixture({ isPublished: true, organizationId: orgId });
    courseId = course.id;

    const [ch1, ch2] = await Promise.all([
      chapterFixture({ courseId, isPublished: true, organizationId: orgId, position: 0 }),
      chapterFixture({ courseId, isPublished: true, organizationId: orgId, position: 1 }),
    ]);

    chapter1Id = ch1.id;
    chapter2Id = ch2.id;

    const [ls1, ls2] = await Promise.all([
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

    lesson1Id = ls1.id;
    lesson2Id = ls2.id;

    const ls3 = await lessonFixture({
      chapterId: chapter2Id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });

    lesson3Id = ls3.id;

    const [act1, act2, act3] = await Promise.all([
      activityFixture({
        isPublished: true,
        lessonId: lesson1Id,
        organizationId: orgId,
        position: 0,
      }),
      activityFixture({
        isPublished: true,
        lessonId: lesson2Id,
        organizationId: orgId,
        position: 0,
      }),
      activityFixture({
        isPublished: true,
        lessonId: lesson3Id,
        organizationId: orgId,
        position: 0,
      }),
    ]);

    activity1Id = act1.id;
    activity2Id = act2.id;
    activity3Id = act3.id;
  });

  test("returns next lesson in same chapter", async () => {
    const result = await getNextLessonId(activity1Id);
    expect(result).toBe(lesson2Id);
  });

  test("returns first lesson of next chapter when current is last in chapter", async () => {
    const result = await getNextLessonId(activity2Id);
    expect(result).toBe(lesson3Id);
  });

  test("returns null when on last lesson of course", async () => {
    const result = await getNextLessonId(activity3Id);
    expect(result).toBeNull();
  });

  test("returns null for non-existent activity", async () => {
    const result = await getNextLessonId(BigInt(999_999_999));
    expect(result).toBeNull();
  });

  test("skips unpublished lessons", async () => {
    const testOrg = await organizationFixture({ kind: "brand" });
    const testCourse = await courseFixture({ isPublished: true, organizationId: testOrg.id });
    const testChapter = await chapterFixture({
      courseId: testCourse.id,
      isPublished: true,
      organizationId: testOrg.id,
      position: 0,
    });

    const [publishedLesson, , nextPublishedLesson] = await Promise.all([
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

    const testActivity = await activityFixture({
      isPublished: true,
      lessonId: publishedLesson.id,
      organizationId: testOrg.id,
      position: 0,
    });

    const result = await getNextLessonId(testActivity.id);
    expect(result).toBe(nextPublishedLesson.id);
  });

  test("skips unpublished chapters", async () => {
    const testOrg = await organizationFixture({ kind: "brand" });
    const testCourse = await courseFixture({ isPublished: true, organizationId: testOrg.id });

    const [publishedCh, , nextPublishedCh] = await Promise.all([
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

    const [currentLesson, , nextLesson] = await Promise.all([
      lessonFixture({
        chapterId: publishedCh.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: publishedCh.id,
        isPublished: false,
        organizationId: testOrg.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: nextPublishedCh.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
    ]);

    const testActivity = await activityFixture({
      isPublished: true,
      lessonId: currentLesson.id,
      organizationId: testOrg.id,
      position: 0,
    });

    const result = await getNextLessonId(testActivity.id);
    expect(result).toBe(nextLesson.id);
  });
});
