import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { getContinueLearning } from "./get-continue-learning";

const MAX_CONTINUE_LEARNING_ITEMS = 4;

async function createCourseWithActivities(organizationId: number) {
  const course = await courseFixture({
    isPublished: true,
    organizationId,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId,
    position: 0,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    organizationId,
    position: 0,
  });

  const [activity1, activity2] = await Promise.all([
    activityFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: lesson.id,
      organizationId,
      position: 0,
    }),
    activityFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: lesson.id,
      organizationId,
      position: 1,
    }),
  ]);

  return { activity1, activity2, chapter, course, lesson };
}

describe("unauthenticated users", () => {
  test("returns empty array", async () => {
    const result = await getContinueLearning(new Headers());
    expect(result).toEqual([]);
  });
});

describe("authenticated users", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
  });

  test("returns empty array when user has no completions", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const result = await getContinueLearning(headers);
    expect(result).toEqual([]);
  });

  test("returns courses with next activity info based on completions", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const { activity1, activity2, chapter, course, lesson } = await createCourseWithActivities(
      organization.id,
    );

    await activityProgressFixture({
      activityId: activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });

    const result = await getContinueLearning(headers);

    expect(result).toHaveLength(1);
    expect(result[0]?.course.id).toBe(course.id);
    expect(result[0]?.chapter.id).toBe(chapter.id);
    expect(result[0]?.lesson.id).toBe(lesson.id);
    expect(result[0]?.activity.id).toBe(activity2.id);
  });

  test("orders by most recent completion", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const data1 = await createCourseWithActivities(organization.id);
    const data2 = await createCourseWithActivities(organization.id);

    const now = new Date();

    await Promise.all([
      activityProgressFixture({
        activityId: data1.activity1.id,
        completedAt: new Date(now.getTime() - 1000),
        durationSeconds: 60,
        userId: Number(user.id),
      }),
      activityProgressFixture({
        activityId: data2.activity1.id,
        completedAt: now,
        durationSeconds: 60,
        userId: Number(user.id),
      }),
    ]);

    const result = await getContinueLearning(headers);

    expect(result).toHaveLength(2);
    expect(result[0]?.course.id).toBe(data2.course.id);
    expect(result[1]?.course.id).toBe(data1.course.id);
  });

  test("limits to max items", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const courses = await Promise.all(
      Array.from({ length: MAX_CONTINUE_LEARNING_ITEMS + 1 }, () =>
        createCourseWithActivities(organization.id),
      ),
    );

    const now = new Date();

    await Promise.all(
      courses.map((data, idx) =>
        activityProgressFixture({
          activityId: data.activity1.id,
          completedAt: new Date(now.getTime() + idx * 1000),
          durationSeconds: 60,
          userId: Number(user.id),
        }),
      ),
    );

    const result = await getContinueLearning(headers);

    expect(result).toHaveLength(MAX_CONTINUE_LEARNING_ITEMS);
  });

  test("filters out completed courses", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const { activity1, activity2 } = await createCourseWithActivities(organization.id);

    await Promise.all([
      activityProgressFixture({
        activityId: activity1.id,
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        userId: Number(user.id),
      }),
      activityProgressFixture({
        activityId: activity2.id,
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        userId: Number(user.id),
      }),
    ]);

    const result = await getContinueLearning(headers);

    expect(result).toEqual([]);
  });

  test("finds activity in next chapter when current chapter is complete", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const course = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
    });

    const [chapter1, chapter2] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({
        chapterId: chapter1.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter2.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
    ]);

    const [activity1, activity2] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson1.id,
        organizationId: organization.id,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson2.id,
        organizationId: organization.id,
        position: 0,
      }),
    ]);

    await activityProgressFixture({
      activityId: activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });

    const result = await getContinueLearning(headers);

    expect(result).toHaveLength(1);
    expect(result[0]?.activity.id).toBe(activity2.id);
    expect(result[0]?.chapter.id).toBe(chapter2.id);
  });

  test("excludes courses from non-brand organizations", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const schoolOrg = await organizationFixture({ kind: "school" });
    const { activity1, activity2 } = await createCourseWithActivities(schoolOrg.id);

    await Promise.all([
      activityProgressFixture({
        activityId: activity1.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: Number(user.id),
      }),
      activityProgressFixture({
        activityId: activity2.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: Number(user.id),
      }),
    ]);

    const result = await getContinueLearning(headers);

    expect(result).toEqual([]);
  });

  test("returns null organization for personal courses", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const course = await courseFixture({
      isPublished: true,
      mode: "quickLesson",
      organizationId: null,
      userId: Number(user.id),
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: null,
      position: 0,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: null,
      position: 0,
    });

    const [activity1, activity2] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson.id,
        organizationId: null,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson.id,
        organizationId: null,
        position: 1,
      }),
    ]);

    await activityProgressFixture({
      activityId: activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });

    const result = await getContinueLearning(headers);

    expect(result).toHaveLength(1);
    expect(result[0]?.course.id).toBe(course.id);
    expect(result[0]?.course.organization).toBeNull();
    expect(result[0]?.activity.id).toBe(activity2.id);
  });
});
