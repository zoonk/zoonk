import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { expect, test } from "./fixtures";

/**
 * Course pages aggregate progress from the direct lessons inside each chapter.
 * This fixture keeps the hierarchy the same as the UI: course, chapters, and
 * direct lesson rows only.
 */
async function createCourseProgressScenario() {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-progress-course-${uniqueId}`,
    title: `E2E Progress Course ${uniqueId}`,
  });

  const [chapter1, chapter2, chapter3] = await Promise.all([
    chapterFixture({
      courseId: course.id,
      description: `Chapter 1 desc ${uniqueId}`,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      slug: `e2e-ch1-${uniqueId}`,
      title: `E2E Chapter One ${uniqueId}`,
    }),
    chapterFixture({
      courseId: course.id,
      description: `Chapter 2 desc ${uniqueId}`,
      isPublished: true,
      organizationId: org.id,
      position: 1,
      slug: `e2e-ch2-${uniqueId}`,
      title: `E2E Chapter Two ${uniqueId}`,
    }),
    chapterFixture({
      courseId: course.id,
      description: `Chapter 3 desc ${uniqueId}`,
      isPublished: true,
      organizationId: org.id,
      position: 2,
      slug: `e2e-ch3-${uniqueId}`,
      title: `E2E Chapter Three ${uniqueId}`,
    }),
  ]);

  const [ch1Lesson1, ch1Lesson2, ch1Lesson3, ch2Lesson1, ch2Lesson2, ch3Lesson1, ch3Lesson2] =
    await Promise.all([
      lessonFixture({
        chapterId: chapter1.id,
        isPublished: true,
        organizationId: org.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter1.id,
        isPublished: true,
        organizationId: org.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: chapter1.id,
        isPublished: true,
        organizationId: org.id,
        position: 2,
      }),
      lessonFixture({
        chapterId: chapter2.id,
        isPublished: true,
        organizationId: org.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter2.id,
        isPublished: true,
        organizationId: org.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: chapter3.id,
        isPublished: true,
        organizationId: org.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter3.id,
        isPublished: true,
        organizationId: org.id,
        position: 1,
      }),
    ]);

  return {
    chapter1,
    chapter2,
    chapter3,
    course,
    lessons: { ch1Lesson1, ch1Lesson2, ch1Lesson3, ch2Lesson1, ch2Lesson2, ch3Lesson1, ch3Lesson2 },
  };
}

/**
 * This creates a chapter with one completed lesson and one incomplete lesson.
 * The chapter should remain in progress because chapter completion is based on
 * every published lesson in the chapter, not only the latest progress row.
 */
async function createCourseWithIncompleteChapter() {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-progress-edge-course-${uniqueId}`,
    title: `E2E Progress Edge Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    description: `Edge chapter ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-progress-edge-ch-${uniqueId}`,
    title: `E2E Edge Chapter ${uniqueId}`,
  });

  const [completedLesson] = await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      title: `Completed Lesson ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
      position: 1,
      title: `Pending Lesson ${uniqueId}`,
    }),
  ]);

  return { chapter, completedLesson, course };
}

/**
 * Direct lesson completion is the only progress signal these catalog tests
 * need. This helper keeps the setup consistent across aggregate scenarios.
 */
async function completeLessons({ lessons, userId }: { lessons: { id: string }[]; userId: string }) {
  await Promise.all(
    lessons.map((lesson) =>
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: lesson.id,
        userId,
      }),
    ),
  );
}

test.describe("Course Progress Indicators", () => {
  test("shows no indicators when user has no progress", async ({ authenticatedPage }) => {
    const { course } = await createCourseProgressScenario();

    await authenticatedPage.goto(`/b/ai/c/${course.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: course.title }),
    ).toBeVisible();

    await expect(authenticatedPage.getByRole("img", { name: /^completed$/i })).toHaveCount(0);
    await expect(authenticatedPage.getByLabel(/of .+ completed/)).toHaveCount(0);
  });

  test("shows completed checkmarks for chapters with all lessons done", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { lessons, course } = await createCourseProgressScenario();

    await completeLessons({ lessons: Object.values(lessons), userId: withProgressUser.id });

    await authenticatedPage.goto(`/b/ai/c/${course.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: course.title }),
    ).toBeVisible();

    await expect(authenticatedPage.getByRole("img", { name: /^completed$/i })).toHaveCount(3);
  });

  test("shows fraction text for partially completed chapters", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { lessons, course } = await createCourseProgressScenario();

    await completeLessons({
      lessons: [lessons.ch1Lesson1, lessons.ch2Lesson1],
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/ai/c/${course.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: course.title }),
    ).toBeVisible();

    await expect(authenticatedPage.getByLabel("1 of 3 completed")).toBeVisible();
    await expect(authenticatedPage.getByLabel("1 of 2 completed")).toBeVisible();
  });

  test("shows mix of completed, in-progress, and not-started states", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { lessons, course } = await createCourseProgressScenario();

    await completeLessons({
      lessons: [lessons.ch1Lesson1, lessons.ch1Lesson2, lessons.ch1Lesson3, lessons.ch2Lesson1],
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/ai/c/${course.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: course.title }),
    ).toBeVisible();

    await expect(authenticatedPage.getByRole("img", { name: /^completed$/i })).toHaveCount(1);
    await expect(authenticatedPage.getByLabel("1 of 2 completed")).toBeVisible();
  });

  test("keeps a chapter in progress when another published lesson is incomplete", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { completedLesson, chapter, course } = await createCourseWithIncompleteChapter();

    await completeLessons({ lessons: [completedLesson], userId: withProgressUser.id });

    await authenticatedPage.goto(`/b/ai/c/${course.slug}`);

    const chapterLink = authenticatedPage.getByRole("link", {
      name: new RegExp(chapter.title),
    });

    await expect(chapterLink).toBeVisible();
    await expect(chapterLink.getByLabel("1 of 2 completed")).toBeVisible();
    await expect(chapterLink.getByRole("img", { name: /^completed$/i })).toHaveCount(0);
  });
});
