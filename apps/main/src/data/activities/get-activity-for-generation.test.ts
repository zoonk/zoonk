import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, expectTypeOf, test } from "vitest";
import { getActivityForGeneration } from "./get-activity-for-generation";

describe(getActivityForGeneration, () => {
  let org: Awaited<ReturnType<typeof organizationFixture>>;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;
  let activity: Awaited<ReturnType<typeof activityFixture>>;

  beforeAll(async () => {
    org = await aiOrganizationFixture();

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

    activity = await activityFixture({
      generationRunId: "test-run-id",
      generationStatus: "pending",
      isPublished: false,
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 0,
      title: "Activity for Generation",
    });
  });

  test("returns activity with generation info", async () => {
    const result = await getActivityForGeneration(activity.id);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(activity.id);
    expect(result?.generationStatus).toBe("pending");
    expect(result?.generationRunId).toBe("test-run-id");
    expect(result?.kind).toBe("explanation");
    expect(result?.position).toBe(0);
    expect(result?.title).toBe("Activity for Generation");
  });

  test("includes lesson with chapter and course slugs", async () => {
    const result = await getActivityForGeneration(activity.id);

    expect(result?.lesson).not.toBeNull();
    expect(result?.lesson?.id).toBe(lesson.id);
    expect(result?.lesson?.slug).toBe(lesson.slug);
    expect(result?.lesson?.chapter?.slug).toBe(chapter.slug);
    expect(result?.lesson?.chapter?.course?.slug).toBe(course.slug);
  });

  test("returns null for non-existent activity", async () => {
    const result = await getActivityForGeneration(BigInt(999_999_999));

    expect(result).toBeNull();
  });

  test("works with published activities", async () => {
    const publishedActivity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 1,
    });

    const result = await getActivityForGeneration(publishedActivity.id);

    expect(result).not.toBeNull();
    expect(result?.generationStatus).toBe("completed");
  });

  test("includes lesson id for workflow triggering", async () => {
    const result = await getActivityForGeneration(activity.id);

    const lessonData = result?.lesson;
    expect(lessonData?.id).toBe(lesson.id);
    if (lessonData) {
      expectTypeOf(lessonData.id).toBeNumber();
    }
  });

  test("returns null for activities outside the AI organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({
      isPublished: true,
      organizationId: otherOrg.id,
    });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      isPublished: true,
      organizationId: otherOrg.id,
    });
    const otherLesson = await lessonFixture({
      chapterId: otherChapter.id,
      isPublished: true,
      organizationId: otherOrg.id,
    });
    const otherActivity = await activityFixture({
      isPublished: true,
      lessonId: otherLesson.id,
      organizationId: otherOrg.id,
      position: 0,
    });

    const result = await getActivityForGeneration(otherActivity.id);

    expect(result).toBeNull();
  });
});
