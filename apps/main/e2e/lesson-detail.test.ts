import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
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

  const background = await activityFixture({
    isPublished: true,
    kind: "background",
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

  const challenge = await activityFixture({
    isPublished: true,
    kind: "challenge",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 3,
  });

  return {
    activities: { background, challenge, explanation, quiz },
    chapter,
    course,
    lesson,
  };
}

function mockActivityCompletionAPI(page: Page, completedActivityIds: string[]) {
  return page.route("**/v1/progress/activity-completion**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ completedActivityIds }),
      contentType: "application/json",
      status: 200,
    });
  });
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

  test("clicking links in popover navigates correctly", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLessonWithActivities();
    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    const triggerButton = page.getByRole("button", {
      name: lesson.title,
    });
    await triggerButton.click();

    // Verify course link is visible
    await expect(page.getByRole("link", { name: course.title })).toBeVisible();

    // Verify chapter link is visible
    await expect(page.getByRole("link", { name: chapter.title })).toBeVisible();

    // Click the course link
    const courseLink = page.getByRole("link", { name: course.title });
    await courseLink.click({ force: true });

    // Verify URL is correct
    await expect(page).toHaveURL(new RegExp(`/b/${AI_ORG_SLUG}/c/${course.slug}$`));

    // Verify we're on the course page
    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();
  });

  test("displays activity list with titles and descriptions", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLessonWithActivities();
    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    // Scope to the activity list for precise queries
    const activityList = page.getByRole("list", { name: /activities/i });

    await expect(activityList.getByRole("link", { name: /background/i })).toBeVisible();
    await expect(activityList.getByText(/explains why this topic exists/i)).toBeVisible();

    await expect(activityList.getByRole("link", { name: /explanation/i })).toBeVisible();
    await expect(activityList.getByText(/explains what this topic is/i)).toBeVisible();

    await expect(activityList.getByRole("link", { name: /quiz/i })).toBeVisible();
    await expect(activityList.getByText(/tests your understanding/i)).toBeVisible();

    await expect(activityList.getByRole("link", { name: /challenge/i })).toBeVisible();
    await expect(activityList.getByText(/tests analytical thinking/i)).toBeVisible();
  });

  test("clicking activity link navigates to activity page", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLessonWithActivities();
    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    // Scope to the activity list for precise query
    const activityList = page.getByRole("list", { name: /activities/i });
    const activityLink = activityList.getByRole("link", { name: /background/i });
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

    await expect(page).toHaveURL(new RegExp(`/generate/l/${lesson.id}`));
  });

  test("shows not-completed indicators when API returns empty array", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLessonWithActivities();
    await mockActivityCompletionAPI(page, []);

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    const activityList = page.getByRole("list", { name: /activities/i });
    const notCompletedIndicators = activityList.getByRole("img", { name: /not completed/i });
    await expect(notCompletedIndicators).toHaveCount(4);
  });

  test("shows completed indicators for activities in the response", async ({ page }) => {
    const { activities, chapter, course, lesson } = await createTestLessonWithActivities();
    const allIds = [
      String(activities.background.id),
      String(activities.explanation.id),
      String(activities.quiz.id),
      String(activities.challenge.id),
    ];
    await mockActivityCompletionAPI(page, allIds);

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    const activityList = page.getByRole("list", { name: /activities/i });
    const completedIndicators = activityList.getByRole("img", { name: /^completed$/i });
    await expect(completedIndicators).toHaveCount(4);
  });

  test("shows mix of completed and not-completed indicators", async ({ page }) => {
    const { activities, chapter, course, lesson } = await createTestLessonWithActivities();
    await mockActivityCompletionAPI(page, [
      String(activities.background.id),
      String(activities.quiz.id),
    ]);

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    const activityList = page.getByRole("list", { name: /activities/i });
    const completedIndicators = activityList.getByRole("img", { name: /^completed$/i });
    const notCompletedIndicators = activityList.getByRole("img", { name: /not completed/i });
    await expect(completedIndicators).toHaveCount(2);
    await expect(notCompletedIndicators).toHaveCount(2);
  });
});
