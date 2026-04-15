import { randomUUID } from "node:crypto";
import { createOrganization, getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { expect, test } from "./fixtures";

async function createTestLessonWithActivities() {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-course-${uniqueId}`,
    title: `E2E Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-chapter-${uniqueId}`,
    title: `E2E Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E lesson description ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-lesson-${uniqueId}`,
    title: `E2E Lesson ${uniqueId}`,
  });

  const practice = await activityFixture({
    isPublished: true,
    kind: "practice",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
  });

  const explanation = await activityFixture({
    isPublished: true,
    kind: "explanation",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 1,
  });

  const quiz = await activityFixture({
    isPublished: true,
    kind: "quiz",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 2,
  });

  return {
    activities: { explanation, practice, quiz },
    chapter,
    course,
    lesson,
  };
}

async function createTestCustomLessonWithActivities() {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-custom-course-${uniqueId}`,
    title: `E2E Custom Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-custom-chapter-${uniqueId}`,
    title: `E2E Custom Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E custom lesson description ${uniqueId}`,
    isPublished: true,
    kind: "custom",
    organizationId: org.id,
    slug: `e2e-custom-lesson-${uniqueId}`,
    title: `E2E Custom Lesson ${uniqueId}`,
  });

  const firstActivity = await activityFixture({
    description: `First custom activity ${uniqueId}`,
    isPublished: true,
    kind: "custom",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `First custom activity ${uniqueId}`,
  });

  const secondActivity = await activityFixture({
    description: `Second custom activity ${uniqueId}`,
    isPublished: true,
    kind: "custom",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 1,
    title: `Second custom activity ${uniqueId}`,
  });

  return {
    activities: { firstActivity, secondActivity },
    chapter,
    course,
    lesson,
  };
}

test.describe("Lesson Detail Page", () => {
  test("shows lesson content with title, description, and position", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLessonWithActivities();
    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: lesson.title,
      }),
    ).toBeVisible();

    await expect(page.getByText(lesson.description)).toBeVisible();

    const positionIcon = page.getByRole("img", { name: /lesson 01/i });
    await expect(positionIcon).toBeVisible();
  });

  test("non-existent lesson shows 404 page", async ({ page }) => {
    const { chapter, course } = await createTestLessonWithActivities();
    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/nonexistent-lesson`);

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("unpublished lesson shows 404 page", async ({ page }) => {
    const org = await getAiOrganization();
    const uniqueId = randomUUID().slice(0, 8);

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-unpub-lesson-course-${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-unpub-lesson-ch-${uniqueId}`,
    });

    const unpubLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: false,
      organizationId: org.id,
      slug: `e2e-unpub-lesson-${uniqueId}`,
    });

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${unpubLesson.slug}`);

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("displays activity path with kind labels for core lessons", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLessonWithActivities();
    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    const activityList = page.getByRole("list", { name: /activities/i });

    await expect(activityList.getByRole("link", { name: /practice/i })).toBeVisible();
    await expect(activityList.getByRole("link", { name: /explanation/i })).toBeVisible();
    await expect(activityList.getByRole("link", { name: /quiz/i })).toBeVisible();
  });

  test("displays custom activity numbers from zero-based positions", async ({ page }) => {
    const { activities, chapter, course, lesson } = await createTestCustomLessonWithActivities();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    const activityList = page.getByRole("list", { name: /activities/i });
    const firstActivityLink = activityList.getByRole("link", {
      name: new RegExp(activities.firstActivity.title ?? "", "i"),
    });
    const secondActivityLink = activityList.getByRole("link", {
      name: new RegExp(activities.secondActivity.title ?? "", "i"),
    });

    await expect(firstActivityLink).toContainText("01");
    await expect(secondActivityLink).toContainText("02");
    await expect(firstActivityLink).toHaveAttribute("href", /\/a\/0$/);
    await expect(secondActivityLink).toHaveAttribute("href", /\/a\/1$/);
  });

  test("clicking activity link navigates to activity page", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLessonWithActivities();
    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    // Scope to the activity list for precise query
    const activityList = page.getByRole("list", { name: /activities/i });
    const activityLink = activityList.getByRole("link", { name: /practice/i });
    await activityLink.click();

    await expect(page).toHaveURL(new RegExp(`/l/${lesson.slug}/a/0`));
  });

  test("lesson without activities redirects to generate page", async ({ page }) => {
    const org = await getAiOrganization();
    const uniqueId = randomUUID().slice(0, 8);

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-no-act-course-${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-no-act-ch-${uniqueId}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-no-act-lesson-${uniqueId}`,
    });

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await page.waitForURL(new RegExp(`/generate/l/${lesson.id}`));
  });

  test("non-AI lessons without activities stay on the lesson page", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const org = await createOrganization();
    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `non-ai-lesson-course-${uniqueId}`,
      title: `Non AI Lesson Course ${uniqueId}`,
    });
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `non-ai-lesson-chapter-${uniqueId}`,
      title: `Non AI Lesson Chapter ${uniqueId}`,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
      slug: `non-ai-lesson-${uniqueId}`,
      title: `Non AI Lesson ${uniqueId}`,
    });
    const url = `/b/${org.slug}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`;

    await page.goto(url);

    await expect(page).toHaveURL(url);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: `Non AI Lesson ${uniqueId}`,
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /^start$/i })).not.toBeVisible();
  });

  test("shows not-completed indicators for unauthenticated user", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLessonWithActivities();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    const activityList = page.getByRole("list", { name: /activities/i });
    const notCompletedIndicators = activityList.getByRole("img", { name: /not completed/i });
    await expect(notCompletedIndicators).toHaveCount(3);
  });

  test("shows completed indicators for activities with progress", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { activities, chapter, course, lesson } = await createTestLessonWithActivities();

    await Promise.all([
      activityProgressFixture({
        activityId: activities.practice.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.explanation.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.quiz.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
    ]);

    await authenticatedPage.goto(
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`,
    );

    const activityList = authenticatedPage.getByRole("list", { name: /activities/i });
    const completedIndicators = activityList.getByRole("img", { name: /^completed$/i });
    await expect(completedIndicators).toHaveCount(3);
  });

  test("shows mix of completed and not-completed indicators", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { activities, chapter, course, lesson } = await createTestLessonWithActivities();

    await Promise.all([
      activityProgressFixture({
        activityId: activities.practice.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.quiz.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
    ]);

    await authenticatedPage.goto(
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`,
    );

    const activityList = authenticatedPage.getByRole("list", { name: /activities/i });
    const completedIndicators = activityList.getByRole("img", { name: /^completed$/i });
    const notCompletedIndicators = activityList.getByRole("img", { name: /not completed/i });
    await expect(completedIndicators).toHaveCount(2);
    await expect(notCompletedIndicators).toHaveCount(1);
  });
});
