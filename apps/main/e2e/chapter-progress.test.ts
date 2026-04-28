import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { expect, test } from "./fixtures";

/**
 * Chapter pages list lessons directly, so this fixture creates only the
 * lesson rows that appear in the learner-facing list. Progress assertions
 * should be against those lessons, not a hidden child layer.
 */
async function createChapterProgressScenario() {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-chprog-course-${uniqueId}`,
    title: `E2E ChProg Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    description: `Chapter desc ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-chprog-ch-${uniqueId}`,
    title: `E2E ChProg Chapter ${uniqueId}`,
  });

  const [lesson1, lesson2, lesson3] = await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      description: `Lesson 1 desc ${uniqueId}`,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      slug: `e2e-l1-${uniqueId}`,
      title: `E2E Lesson One ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: chapter.id,
      description: `Lesson 2 desc ${uniqueId}`,
      isPublished: true,
      organizationId: org.id,
      position: 1,
      slug: `e2e-l2-${uniqueId}`,
      title: `E2E Lesson Two ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: chapter.id,
      description: `Lesson 3 desc ${uniqueId}`,
      isPublished: true,
      organizationId: org.id,
      position: 2,
      slug: `e2e-l3-${uniqueId}`,
      title: `E2E Lesson Three ${uniqueId}`,
    }),
  ]);

  return { chapter, course, lessons: { lesson1, lesson2, lesson3 } };
}

/**
 * Marking a lesson complete now means one `LessonProgress` row for the lesson
 * itself. Keeping that write behind a helper makes stale child-lesson progress
 * setup obvious in this refactor.
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

test.describe("Chapter Progress Indicators", () => {
  test("shows no indicators when user has no progress", async ({ authenticatedPage }) => {
    const { chapter, course } = await createChapterProgressScenario();

    await authenticatedPage.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: chapter.title }),
    ).toBeVisible();

    await expect(authenticatedPage.getByRole("img", { name: /^completed$/i })).toHaveCount(0);
    await expect(authenticatedPage.getByLabel(/of .+ completed/)).toHaveCount(0);
  });

  test("shows completed checkmarks for completed lessons", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { lessons, chapter, course } = await createChapterProgressScenario();

    await completeLessons({ lessons: Object.values(lessons), userId: withProgressUser.id });

    await authenticatedPage.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: chapter.title }),
    ).toBeVisible();

    await expect(authenticatedPage.getByRole("img", { name: /^completed$/i })).toHaveCount(3);
  });

  test("shows completed and not-started lesson states", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { lessons, chapter, course } = await createChapterProgressScenario();

    await completeLessons({ lessons: [lessons.lesson1], userId: withProgressUser.id });

    await authenticatedPage.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: chapter.title }),
    ).toBeVisible();

    await expect(authenticatedPage.getByRole("img", { name: /^completed$/i })).toHaveCount(1);
    await expect(authenticatedPage.getByLabel(/of .+ completed/)).toHaveCount(0);
  });
});
