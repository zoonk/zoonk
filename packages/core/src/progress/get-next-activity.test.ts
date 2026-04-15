import { prisma } from "@zoonk/db";
import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { signInAs } from "@zoonk/testing/fixtures/auth";
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

  test("returns first activity when unauthenticated", async () => {
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

    await Promise.all([
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

    const result = await getNextActivity({
      headers: new Headers(),
      scope: { courseId: course.id },
    });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonSlug: lesson.slug,
    });
  });

  test("returns the first lesson shell when an unauthenticated course starts with a shell-only lesson", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const [shellLesson, generatedLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: generatedLesson.id,
      organizationId: organization.id,
      position: 0,
    });

    const result = await getNextActivity({
      headers: new Headers(),
      scope: { courseId: course.id },
    });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      canPrefetch: false,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonSlug: shellLesson.slug,
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

    await Promise.all([
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

    const headers = await signInAs(user.email, user.password);
    const result = await getNextActivity({ headers, scope: { courseId: course.id } });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonSlug: lesson.slug,
    });
  });

  test("returns first activity with canPrefetch=false when it is not generated", async () => {
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

    await Promise.all([
      activityFixture({
        generationStatus: "pending",
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

    const result = await getNextActivity({
      headers: new Headers(),
      scope: { courseId: course.id },
    });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      canPrefetch: false,
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
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getNextActivity({ headers, scope: { courseId: course.id } });

    expect(result).toEqual({
      activityPosition: 1,
      brandSlug: organization.slug,
      canPrefetch: true,
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
        userId: user.id,
      }),
      activityProgressFixture({
        activityId: activityB1.id,
        completedAt: now,
        durationSeconds: 60,
        userId: user.id,
      }),
    ]);

    const headers = await signInAs(user.email, user.password);
    const result = await getNextActivity({ headers, scope: { courseId: course.id } });

    expect(result).toEqual({
      activityPosition: 1,
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: chapterB.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: lessonB.slug,
    });
  });

  test("skips newly added lessons inside a durably completed chapter", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const [completedChapter, nextChapter] = await Promise.all([
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

    const [completedLesson, addedLesson, nextLesson] = await Promise.all([
      lessonFixture({
        chapterId: completedChapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: completedChapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: nextChapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
    ]);

    const [completedActivity, nextActivity] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: completedLesson.id,
        organizationId: organization.id,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: nextLesson.id,
        organizationId: organization.id,
        position: 0,
      }),
    ]);

    await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: addedLesson.id,
      organizationId: organization.id,
      position: 0,
    });

    await Promise.all([
      activityProgressFixture({
        activityId: completedActivity.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: user.id,
      }),
      prisma.chapterCompletion.create({
        data: {
          chapterId: completedChapter.id,
          userId: user.id,
        },
      }),
    ]);

    const headers = await signInAs(user.email, user.password);
    const result = await getNextActivity({ headers, scope: { courseId: course.id } });

    expect(result).toEqual({
      activityPosition: nextActivity.position,
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: nextChapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: nextLesson.slug,
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
        userId: user.id,
      }),
      activityProgressFixture({
        activityId: activity2.id,
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        userId: user.id,
      }),
    ]);

    const headers = await signInAs(user.email, user.password);
    const result = await getNextActivity({ headers, scope: { courseId: course.id } });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: chapter.slug,
      completed: true,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: lesson.slug,
    });
  });

  test("returns the next lesson shell after the latest completed lesson", async () => {
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

    const [, completedLesson, nextLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: organization.id,
        position: 2,
      }),
    ]);

    const completedActivity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: completedLesson.id,
      organizationId: organization.id,
      position: 0,
    });

    await activityProgressFixture({
      activityId: completedActivity.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getNextActivity({ headers, scope: { courseId: course.id } });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      canPrefetch: false,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: nextLesson.slug,
    });
  });

  test("returns pending lesson when all generated activities are completed but a lesson is ungenerated", async () => {
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
        generationStatus: "pending",
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const activity1 = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: lesson1.id,
      organizationId: organization.id,
      position: 0,
    });

    await activityProgressFixture({
      activityId: activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getNextActivity({ headers, scope: { courseId: course.id } });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      canPrefetch: false,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: lesson2.slug,
    });
  });

  test("returns pending lesson when all generated activities are completed but an activity is ungenerated", async () => {
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
        generationStatus: "pending",
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
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getNextActivity({ headers, scope: { courseId: course.id } });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      canPrefetch: false,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: lesson2.slug,
    });
  });

  test("returns the first lesson shell when no published activities exist yet", async () => {
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

    const result = await getNextActivity({
      headers: new Headers(),
      scope: { courseId: course.id },
    });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      canPrefetch: false,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonSlug: lesson.slug,
    });
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

    const result = await getNextActivity({
      headers: new Headers(),
      scope: { courseId: course.id },
    });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      canPrefetch: true,
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

    await Promise.all([
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

    const result = await getNextActivity({
      headers: new Headers(),
      scope: { chapterId: chapter.id },
    });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      canPrefetch: true,
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
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getNextActivity({ headers, scope: { chapterId: chapter.id } });

    expect(result).toEqual({
      activityPosition: 1,
      brandSlug: organization.slug,
      canPrefetch: true,
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
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getNextActivity({ headers, scope: { chapterId: chapter1.id } });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      canPrefetch: true,
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

    await Promise.all([
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

    const result = await getNextActivity({
      headers: new Headers(),
      scope: { lessonId: lesson.id },
    });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      canPrefetch: true,
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
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getNextActivity({ headers, scope: { lessonId: lesson.id } });

    expect(result).toEqual({
      activityPosition: 1,
      brandSlug: organization.slug,
      canPrefetch: true,
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
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getNextActivity({ headers, scope: { lessonId: lesson1.id } });

    expect(result).toEqual({
      activityPosition: 0,
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: chapter.slug,
      completed: true,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: lesson1.slug,
    });
  });

  test("skips archived activities when choosing the next activity", async () => {
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

    const [completedActivity, , nextActiveActivity] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson.id,
        organizationId: organization.id,
        position: 0,
      }),
      activityFixture({
        archivedAt: new Date(),
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson.id,
        organizationId: organization.id,
        position: 1,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson.id,
        organizationId: organization.id,
        position: 2,
      }),
    ]);

    await activityProgressFixture({
      activityId: completedActivity.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getNextActivity({ headers, scope: { courseId: course.id } });

    expect(result).toEqual({
      activityPosition: nextActiveActivity.position,
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: lesson.slug,
    });
  });
});
