import { prisma } from "@zoonk/db";
import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture, courseUserFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { getContinueLearning, MAX_CONTINUE_LEARNING_ITEMS } from "./get-continue-learning";

async function createCourseWithActivity(organizationId: number) {
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

  const activity = await activityFixture({
    isPublished: true,
    lessonId: lesson.id,
    organizationId,
    position: 1,
  });

  return { activity, chapter, course, lesson };
}

describe("unauthenticated users", () => {
  test("returns empty array", async () => {
    const result = await getContinueLearning({ headers: new Headers() });
    expect(result).toEqual([]);
  });
});

describe("authenticated users", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
  });

  test("returns empty array when user has no courses", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const result = await getContinueLearning({ headers });
    expect(result).toEqual([]);
  });

  test("returns courses with next activity info", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const { activity, chapter, course, lesson } = await createCourseWithActivity(organization.id);

    await courseUserFixture({
      courseId: course.id,
      userId: Number(user.id),
    });

    const result = await getContinueLearning({ headers });

    expect(result).toHaveLength(1);
    expect(result[0]?.course.id).toBe(course.id);
    expect(result[0]?.chapter.id).toBe(chapter.id);
    expect(result[0]?.lesson.id).toBe(lesson.id);
    expect(result[0]?.activity.id).toBe(activity.id);
  });

  test("returns max courses ordered by most recent", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const courseData = await Promise.all(
      Array.from({ length: MAX_CONTINUE_LEARNING_ITEMS + 1 }, () =>
        createCourseWithActivity(organization.id),
      ),
    );

    const now = new Date();
    await prisma.courseUser.createMany({
      data: courseData.map((data, i) => ({
        courseId: data.course.id,
        startedAt: new Date(now.getTime() + i * 1000),
        userId: Number(user.id),
      })),
    });

    const result = await getContinueLearning({ headers });

    expect(result).toHaveLength(MAX_CONTINUE_LEARNING_ITEMS);

    const resultCourseIds = result.map((item) => item.course.id);
    const expectedIds = courseData
      .slice(1)
      .map((data) => data.course.id)
      .toReversed();
    expect(resultCourseIds).toEqual(expectedIds);
  });

  test("correctly identifies next incomplete activity", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const course = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const activity1 = await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 1,
    });

    const activity2 = await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 2,
    });

    await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 3,
    });

    await courseUserFixture({
      courseId: course.id,
      userId: Number(user.id),
    });

    await activityProgressFixture({
      activityId: activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });

    const result = await getContinueLearning({ headers });

    expect(result).toHaveLength(1);
    expect(result[0]?.activity.id).toBe(activity2.id);
  });

  test("finds activity in next chapter when current chapter is complete", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const course = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
    });

    const chapter1 = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const chapter2 = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 1,
    });

    const lesson1 = await lessonFixture({
      chapterId: chapter1.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const lesson2 = await lessonFixture({
      chapterId: chapter2.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const activity1 = await activityFixture({
      isPublished: true,
      lessonId: lesson1.id,
      organizationId: organization.id,
      position: 1,
    });

    const activity2 = await activityFixture({
      isPublished: true,
      lessonId: lesson2.id,
      organizationId: organization.id,
      position: 1,
    });

    await courseUserFixture({
      courseId: course.id,
      userId: Number(user.id),
    });

    await activityProgressFixture({
      activityId: activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });

    const result = await getContinueLearning({ headers });

    expect(result).toHaveLength(1);
    expect(result[0]?.activity.id).toBe(activity2.id);
    expect(result[0]?.chapter.id).toBe(chapter2.id);
  });
});
