import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, describe, expect, test } from "vitest";
import { getActivity } from "./get-activity";

describe(getActivity, () => {
  let org: Awaited<ReturnType<typeof organizationFixture>>;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;
  let activity: Awaited<ReturnType<typeof activityFixture>>;
  let step1: Awaited<ReturnType<typeof stepFixture>>;
  let step2: Awaited<ReturnType<typeof stepFixture>>;

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

    activity = await activityFixture({
      description: "Test activity description",
      generationStatus: "completed",
      isPublished: true,
      kind: "background",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 0,
      title: "Test Activity",
    });

    [step1, step2] = await Promise.all([
      stepFixture({
        activityId: activity.id,
        content: { text: "Step 1 content", title: "Step 1" },
        position: 0,
      }),
      stepFixture({
        activityId: activity.id,
        content: { text: "Step 2 content", title: "Step 2" },
        position: 1,
      }),
    ]);
  });

  test("returns activity with steps", async () => {
    const result = await getActivity({ lessonId: lesson.id, position: 0 });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(activity.id);
    expect(result?.title).toBe("Test Activity");
    expect(result?.description).toBe("Test activity description");
    expect(result?.kind).toBe("background");
    expect(result?.steps).toHaveLength(2);
  });

  test("orders steps by position ascending", async () => {
    const result = await getActivity({ lessonId: lesson.id, position: 0 });

    expect(result?.steps[0]?.id).toBe(step1.id);
    expect(result?.steps[0]?.position).toBe(0);
    expect(result?.steps[1]?.id).toBe(step2.id);
    expect(result?.steps[1]?.position).toBe(1);
  });

  test("returns generation status", async () => {
    const result = await getActivity({ lessonId: lesson.id, position: 0 });

    expect(result?.generationStatus).toBe("completed");
  });

  test("returns null for unpublished activity", async () => {
    const draftActivity = await activityFixture({
      isPublished: false,
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 1,
    });

    const result = await getActivity({ lessonId: lesson.id, position: draftActivity.position });

    expect(result).toBeNull();
  });

  test("returns null for non-existent position", async () => {
    const result = await getActivity({ lessonId: lesson.id, position: 999 });

    expect(result).toBeNull();
  });

  test("returns null for non-existent lesson", async () => {
    const result = await getActivity({ lessonId: 999_999, position: 0 });

    expect(result).toBeNull();
  });

  test("includes step content and visual information", async () => {
    const result = await getActivity({ lessonId: lesson.id, position: 0 });

    expect(result?.steps[0]?.content).toEqual({ text: "Step 1 content", title: "Step 1" });
    expect(result?.steps[0]?.kind).toBe("static");
  });
});
