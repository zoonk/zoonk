import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
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
 * This scenario isolates the course-level progress suffix from the chapter
 * card details. The only unfinished lesson is hidden by the user's preference,
 * so the chapter should count as complete in both places.
 */
async function createCourseWithHiddenIncompleteLesson() {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-progress-hidden-course-${uniqueId}`,
    title: `E2E Progress Hidden Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    description: `Hidden lesson chapter ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-progress-hidden-ch-${uniqueId}`,
    title: `E2E Hidden Progress Chapter ${uniqueId}`,
  });

  const [visibleLesson] = await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      kind: "explanation",
      organizationId: org.id,
      position: 0,
      title: `Visible Lesson ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      kind: "quiz",
      organizationId: org.id,
      position: 1,
      title: `Hidden Quiz ${uniqueId}`,
    }),
  ]);

  return { chapter, course, visibleLesson };
}

/**
 * Chapter cards still derive their status from direct lesson completion, so
 * this helper keeps that lower-level setup consistent across scenarios.
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

/**
 * Some scenarios still need durable chapter completions to cover the path
 * where previously finished chapters stay complete after lesson changes.
 */
async function completeChapters({
  chapters,
  userId,
}: {
  chapters: { id: string }[];
  userId: string;
}) {
  await Promise.all(
    chapters.map((chapter) =>
      prisma.chapterCompletion.create({ data: { chapterId: chapter.id, userId } }),
    ),
  );
}

test.describe("Course Progress Indicators", () => {
  test("shows the chapter list before progress starts", async ({ authenticatedPage }) => {
    const { chapter1, chapter2, chapter3, course } = await createCourseProgressScenario();

    await authenticatedPage.goto(`/b/ai/c/${course.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: course.title }),
    ).toBeVisible();

    const main = authenticatedPage.getByRole("main");

    await expect(main.getByPlaceholder("Search chapters...")).toBeVisible();
    await expect(main.getByRole("link", { name: new RegExp(chapter1.title, "u") })).toBeVisible();
    await expect(main.getByRole("link", { name: new RegExp(chapter2.title, "u") })).toBeVisible();
    await expect(main.getByRole("link", { name: new RegExp(chapter3.title, "u") })).toBeVisible();
    await expect(main.getByRole("link", { name: /try free chapter/iu })).toHaveCount(0);
    await expect(main.getByText(/^completed$/iu)).toHaveCount(0);
    await expect(main.getByText(/\d+\/\d+ done/u)).toHaveCount(0);
  });

  test("shows completed status for chapters with all lessons done", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { chapter1, chapter2, chapter3, lessons, course } = await createCourseProgressScenario();

    await Promise.all([
      completeLessons({ lessons: Object.values(lessons), userId: withProgressUser.id }),
      completeChapters({ chapters: [chapter1, chapter2, chapter3], userId: withProgressUser.id }),
    ]);

    await authenticatedPage.goto(`/b/ai/c/${course.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: course.title }),
    ).toBeVisible();

    const main = authenticatedPage.getByRole("main");

    const reviewLink = main.getByRole("link", { name: "Review 100% complete" });
    await expect(reviewLink).toBeVisible();

    await expect(reviewLink.getByText("100%", { exact: true })).toBeVisible();
    await expect(authenticatedPage.getByRole("main").getByText(/^completed$/iu)).toHaveCount(3);
  });

  test("shows lesson percentage when only lessons are partially completed", async ({
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

    const main = authenticatedPage.getByRole("main");

    const continueLink = main.getByRole("link", { name: "Continue 29% complete" });
    await expect(continueLink).toBeVisible();

    await expect(continueLink.getByText("29%", { exact: true })).toBeVisible();
    await expect(authenticatedPage.getByText("1/3 done")).toBeVisible();
    await expect(authenticatedPage.getByText("1/2 done")).toBeVisible();
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

    const main = authenticatedPage.getByRole("main");
    await expect(main.getByText(/^completed$/iu)).toHaveCount(1);
    await expect(main.getByText("1/2 done")).toBeVisible();
  });

  test("keeps a chapter in progress when another published lesson is incomplete", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { completedLesson, chapter, course } = await createCourseWithIncompleteChapter();

    await completeLessons({ lessons: [completedLesson], userId: withProgressUser.id });

    await authenticatedPage.goto(`/b/ai/c/${course.slug}`);

    const chapterLink = authenticatedPage.getByRole("link", {
      name: new RegExp(chapter.title, "u"),
    });

    await expect(chapterLink).toBeVisible();
    await expect(chapterLink.getByText("1/2 done")).toBeVisible();
    await expect(chapterLink.getByText(/^completed$/iu)).toHaveCount(0);
  });

  test("ignores hidden lesson types in course progress", async ({ browser }) => {
    const [{ chapter, course, visibleLesson }, user] = await Promise.all([
      createCourseWithHiddenIncompleteLesson(),
      createE2EUser(getBaseURL(), { orgRole: "member" }),
    ]);

    const [context] = await Promise.all([
      browser.newContext({ storageState: user.storageState }),
      completeLessons({ lessons: [visibleLesson], userId: user.id }),
      prisma.userLearningProfile.create({
        data: { preferences: { hiddenLessonKinds: ["quiz"] }, userId: user.id },
      }),
    ]);

    const page = await context.newPage();

    await page.goto(`/b/ai/c/${course.slug}`);

    const main = page.getByRole("main");

    await expect(main.getByRole("link", { name: "Review 100% complete" })).toBeVisible();

    const chapterLink = main.getByRole("link", { name: new RegExp(chapter.title, "u") });

    await expect(chapterLink.getByText(/^completed$/iu)).toBeVisible();
    await expect(chapterLink.getByText("1/2 done")).toHaveCount(0);

    await context.close();
  });
});
