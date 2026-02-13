import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { getNextActivity } from "./get-next-activity";

describe("getNextActivity - course scope", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
  });

  test("returns first activity when userId is 0 (unauthenticated)", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
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

    await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 0,
    });

    const result = await getNextActivity(0, { courseId: course.id });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonSlug: lesson.slug,
    });
  });

  test("returns first activity when user has no completions", async () => {
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
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 0,
    });

    const result = await getNextActivity(Number(user.id), { courseId: course.id });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonSlug: lesson.slug,
    });
  });

  test("returns next activity after last completed (sequential)", async () => {
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
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const [activity1] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson.id,
        organizationId: organization.id,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson.id,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    await activityProgressFixture({
      activityId: activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });

    const result = await getNextActivity(Number(user.id), { courseId: course.id });

    expect(result).toEqual({
      activityPosition: 1,
      brandSlug: organization.slug,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: lesson.slug,
    });
  });

  test("returns next after last completed across chapters (non-sequential)", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const [chapterA, chapterB] = await Promise.all([
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

    const [lessonA, lessonB] = await Promise.all([
      lessonFixture({
        chapterId: chapterA.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapterB.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
    ]);

    const [activityA1, , activityB1] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lessonA.id,
        organizationId: organization.id,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lessonA.id,
        organizationId: organization.id,
        position: 1,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lessonB.id,
        organizationId: organization.id,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lessonB.id,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const now = new Date();

    await Promise.all([
      activityProgressFixture({
        activityId: activityA1.id,
        completedAt: new Date(now.getTime() - 1000),
        durationSeconds: 60,
        userId: Number(user.id),
      }),
      activityProgressFixture({
        activityId: activityB1.id,
        completedAt: now,
        durationSeconds: 60,
        userId: Number(user.id),
      }),
    ]);

    const result = await getNextActivity(Number(user.id), { courseId: course.id });

    expect(result).toEqual({
      activityPosition: 1,
      brandSlug: organization.slug,
      chapterSlug: chapterB.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: lessonB.slug,
    });
  });

  test("returns first activity with completed=true when all completed", async () => {
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
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const [activity1, activity2] = await Promise.all([
      activityFixture({
        isPublished: true,
        lessonId: lesson.id,
        organizationId: organization.id,
        position: 0,
      }),
      activityFixture({
        isPublished: true,
        lessonId: lesson.id,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

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

    const result = await getNextActivity(Number(user.id), { courseId: course.id });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      chapterSlug: chapter.slug,
      completed: true,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: lesson.slug,
    });
  });

  test("returns null when no published activities exist", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
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

    await activityFixture({
      isPublished: false,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 0,
    });

    const result = await getNextActivity(0, { courseId: course.id });

    expect(result).toBeNull();
  });

  test("skips unpublished chapters", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const [, publishedChapter] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        isPublished: false,
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

    const publishedLesson = await lessonFixture({
      chapterId: publishedChapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    await activityFixture({
      isPublished: true,
      lessonId: publishedLesson.id,
      organizationId: organization.id,
      position: 0,
    });

    const result = await getNextActivity(0, { courseId: course.id });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      chapterSlug: publishedChapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonSlug: publishedLesson.slug,
    });
  });
});

describe("getNextActivity - chapter scope", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
  });

  test("returns first activity when user has no completions", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
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

    await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 0,
    });

    const result = await getNextActivity(0, { chapterId: chapter.id });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonSlug: lesson.slug,
    });
  });

  test("returns next activity after last completed within chapter", async () => {
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
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const [activity1] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson.id,
        organizationId: organization.id,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson.id,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    await activityProgressFixture({
      activityId: activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });

    const result = await getNextActivity(Number(user.id), { chapterId: chapter.id });

    expect(result).toEqual({
      activityPosition: 1,
      brandSlug: organization.slug,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: lesson.slug,
    });
  });

  test("scope boundary: returns completed when last chapter activity is done", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

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

    const [activity1] = await Promise.all([
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

    const result = await getNextActivity(Number(user.id), { chapterId: chapter1.id });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      chapterSlug: chapter1.slug,
      completed: true,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: lesson1.slug,
    });
  });
});

describe("getNextActivity - lesson scope", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
  });

  test("returns first activity when user has no completions", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
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

    await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 0,
    });

    const result = await getNextActivity(0, { lessonId: lesson.id });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonSlug: lesson.slug,
    });
  });

  test("returns next activity after last completed within lesson", async () => {
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
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const [activity1] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson.id,
        organizationId: organization.id,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson.id,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    await activityProgressFixture({
      activityId: activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });

    const result = await getNextActivity(Number(user.id), { lessonId: lesson.id });

    expect(result).toEqual({
      activityPosition: 1,
      brandSlug: organization.slug,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: lesson.slug,
    });
  });

  test("scope boundary: returns completed when last lesson activity is done", async () => {
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

    const [activity1] = await Promise.all([
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

    const result = await getNextActivity(Number(user.id), { lessonId: lesson1.id });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      chapterSlug: chapter.slug,
      completed: true,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: lesson1.slug,
    });
  });
});
