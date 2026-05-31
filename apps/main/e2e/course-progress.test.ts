import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
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
 * The course Continue button counts durable chapter completions because
 * generated lessons are not a stable course-level unit.
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
  test("shows zero chapter progress without card indicators", async ({ authenticatedPage }) => {
    const { course } = await createCourseProgressScenario();

    await authenticatedPage.goto(`/b/ai/c/${course.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: course.title }),
    ).toBeVisible();

    const main = authenticatedPage.getByRole("main");
    await expect(main.getByRole("link", { name: "Start 0 of 3 chapters completed" })).toBeVisible();
    await expect(main.getByText("0/3")).toBeVisible();
    await expect(main.getByText(/^completed$/iu)).toHaveCount(0);
    await expect(main.getByText(/\d+\/\d+ done/u)).toHaveCount(0);
  });

  test("shows completed status for chapters with all lessons done", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { chapter1, chapter2, chapter3, lessons, course } = await createCourseProgressScenario();

    await completeLessons({ lessons: Object.values(lessons), userId: withProgressUser.id });

    await completeChapters({
      chapters: [chapter1, chapter2, chapter3],
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/ai/c/${course.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: course.title }),
    ).toBeVisible();

    const main = authenticatedPage.getByRole("main");

    await expect(
      main.getByRole("link", { name: "Review 3 of 3 chapters completed" }),
    ).toBeVisible();

    await expect(main.getByText("3/3")).toBeVisible();
    await expect(authenticatedPage.getByRole("main").getByText(/^completed$/iu)).toHaveCount(3);
  });

  test("shows chapter fraction even when only lessons are partially completed", async ({
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

    await expect(
      main.getByRole("link", { name: "Continue 0 of 3 chapters completed" }),
    ).toBeVisible();

    await expect(main.getByText("0/3")).toBeVisible();
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
});
