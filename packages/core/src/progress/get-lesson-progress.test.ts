import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { getLessonProgress } from "./get-lesson-progress";

describe(getLessonProgress, () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
  });

  async function createPublishedLesson() {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    return lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });
  }

  test("returns empty array when unauthenticated", async () => {
    const lesson = await createPublishedLesson();

    const result = await getLessonProgress({
      headers: new Headers(),
      lessonId: lesson.id,
    });

    expect(result).toEqual([]);
  });

  test("returns empty array when user has no progress", async () => {
    const [user, lesson] = await Promise.all([userFixture(), createPublishedLesson()]);

    const headers = await signInAs(user.email, user.password);
    const result = await getLessonProgress({ headers, lessonId: lesson.id });

    expect(result).toEqual([]);
  });

  test("returns completed lesson ID", async () => {
    const [user, lesson] = await Promise.all([userFixture(), createPublishedLesson()]);

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson.id,
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getLessonProgress({ headers, lessonId: lesson.id });

    expect(result).toEqual([lesson.id]);
  });

  test("excludes started-but-not-completed lessons", async () => {
    const [user, lesson] = await Promise.all([userFixture(), createPublishedLesson()]);

    await lessonProgressFixture({
      completedAt: null,
      durationSeconds: 30,
      lessonId: lesson.id,
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getLessonProgress({ headers, lessonId: lesson.id });

    expect(result).toEqual([]);
  });

  test("only returns the specified completed lesson", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: lesson1.id,
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: lesson2.id,
        userId: user.id,
      }),
    ]);

    const headers = await signInAs(user.email, user.password);
    const result = await getLessonProgress({ headers, lessonId: lesson1.id });

    expect(result).toEqual([lesson1.id]);
  });
});
