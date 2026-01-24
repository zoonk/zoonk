import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { listLessonActivities } from "./list-lesson-activities";

describe(listLessonActivities, () => {
  let org: Awaited<ReturnType<typeof organizationFixture>>;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;
  let publishedActivity1: Awaited<ReturnType<typeof activityFixture>>;
  let publishedActivity2: Awaited<ReturnType<typeof activityFixture>>;
  let draftActivity: Awaited<ReturnType<typeof activityFixture>>;

  beforeAll(async () => {
    org = await organizationFixture({ kind: "brand" });

    course = await courseFixture({
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    [publishedActivity1, publishedActivity2, draftActivity] = await Promise.all([
      activityFixture({
        description: "First activity description",
        isPublished: true,
        kind: "background",
        language: "en",
        lessonId: lesson.id,
        organizationId: org.id,
        position: 1,
        title: "Activity 1",
      }),
      activityFixture({
        description: "Second activity (but position 0)",
        isPublished: true,
        kind: "explanation",
        language: "en",
        lessonId: lesson.id,
        organizationId: org.id,
        position: 0,
        title: "Activity 2",
      }),
      activityFixture({
        isPublished: false,
        kind: "quiz",
        language: "en",
        lessonId: lesson.id,
        organizationId: org.id,
        position: 2,
        title: "Draft Activity",
      }),
    ]);
  });

  test("returns published activities for a lesson", async () => {
    const result = await listLessonActivities({ lessonId: lesson.id });

    expect(result).toHaveLength(2);
    expect(result.some((a) => a.id === publishedActivity1.id)).toBeTruthy();
    expect(result.some((a) => a.id === publishedActivity2.id)).toBeTruthy();
  });

  test("orders activities by position ascending", async () => {
    const result = await listLessonActivities({ lessonId: lesson.id });

    expect(result[0]?.id).toBe(publishedActivity2.id);
    expect(result[0]?.position).toBe(0);
    expect(result[1]?.id).toBe(publishedActivity1.id);
    expect(result[1]?.position).toBe(1);
  });

  test("excludes unpublished activities", async () => {
    const result = await listLessonActivities({ lessonId: lesson.id });

    const draftInResult = result.find((a) => a.id === draftActivity.id);
    expect(draftInResult).toBeUndefined();
  });

  test("returns activity kind", async () => {
    const result = await listLessonActivities({ lessonId: lesson.id });

    const activity1 = result.find((a) => a.id === publishedActivity1.id);
    expect(activity1?.kind).toBe("background");

    const activity2 = result.find((a) => a.id === publishedActivity2.id);
    expect(activity2?.kind).toBe("explanation");
  });

  test("returns activity title and description", async () => {
    const result = await listLessonActivities({ lessonId: lesson.id });

    const activity1 = result.find((a) => a.id === publishedActivity1.id);
    expect(activity1?.title).toBe("Activity 1");
    expect(activity1?.description).toBe("First activity description");
  });

  test("returns empty array for lesson with no activities", async () => {
    const emptyLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    const result = await listLessonActivities({ lessonId: emptyLesson.id });

    expect(result).toEqual([]);
  });

  test("returns empty array for non-existent lesson", async () => {
    const result = await listLessonActivities({ lessonId: 999_999 });

    expect(result).toEqual([]);
  });
});
