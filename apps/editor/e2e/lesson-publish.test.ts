import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { type Page, expect, test } from "./fixtures";

async function createTestLesson(isPublished: boolean) {
  const org = await getAiOrganization();

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-${randomUUID().slice(0, 8)}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-${randomUUID().slice(0, 8)}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished,
    organizationId: org.id,
    slug: `e2e-${randomUUID().slice(0, 8)}`,
  });

  return { chapter, course, lesson };
}

async function navigateToLessonPage(
  page: Page,
  courseSlug: string,
  chapterSlug: string,
  lessonSlug: string,
) {
  await page.goto(`/ai/c/en/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`);

  await expect(page.getByRole("textbox", { name: /edit lesson title/i })).toBeVisible();
}

test.describe("Lesson Publish Toggle", () => {
  test("displays Draft for unpublished lesson", async ({ authenticatedPage }) => {
    const { course, chapter, lesson } = await createTestLesson(false);
    await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

    const publishToggle = authenticatedPage.getByRole("switch");
    const publishLabel = authenticatedPage.locator("label").filter({ has: publishToggle });
    await expect(publishLabel.getByText(/^draft$/i)).toBeVisible();
    await expect(publishToggle).not.toBeChecked();
  });

  test("displays Published for published lesson", async ({ authenticatedPage }) => {
    const { course, chapter, lesson } = await createTestLesson(true);
    await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

    const publishToggle = authenticatedPage.getByRole("switch");
    const publishLabel = authenticatedPage.locator("label").filter({ has: publishToggle });
    await expect(publishLabel.getByText(/^published$/i)).toBeVisible();
    await expect(publishToggle).toBeChecked();
  });

  test("publishes a draft lesson and persists", async ({ authenticatedPage }) => {
    const { course, chapter, lesson } = await createTestLesson(false);
    await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

    const toggle = authenticatedPage.getByRole("switch");
    const publishLabel = authenticatedPage.locator("label").filter({ has: toggle });

    await expect(publishLabel.getByText(/^draft$/i)).toBeVisible();
    await expect(toggle).toBeEnabled();
    await expect(toggle).not.toBeChecked();

    await toggle.click();

    await expect(publishLabel.getByText(/^published$/i)).toBeVisible();
    await expect(toggle).toBeChecked();

    // Wait for the server action to complete (switch re-enables after transition)
    await expect(toggle).toBeEnabled();

    await authenticatedPage.reload();

    await expect(
      authenticatedPage.getByRole("textbox", { name: /edit lesson title/i }),
    ).toBeVisible();
    const reloadedToggle = authenticatedPage.getByRole("switch");
    const reloadedLabel = authenticatedPage.locator("label").filter({ has: reloadedToggle });
    await expect(reloadedLabel.getByText(/^published$/i)).toBeVisible();
    await expect(reloadedToggle).toBeChecked();
  });

  test("unpublishes a published lesson and persists", async ({ authenticatedPage }) => {
    const { course, chapter, lesson } = await createTestLesson(true);
    await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

    const toggle = authenticatedPage.getByRole("switch");
    const publishLabel = authenticatedPage.locator("label").filter({ has: toggle });

    await expect(publishLabel.getByText(/^published$/i)).toBeVisible();
    await expect(toggle).toBeEnabled();
    await expect(toggle).toBeChecked();

    await toggle.click();

    await expect(publishLabel.getByText(/^draft$/i)).toBeVisible();
    await expect(toggle).not.toBeChecked();

    // Wait for the server action to complete (switch re-enables after transition)
    await expect(toggle).toBeEnabled();

    await authenticatedPage.reload();

    await expect(
      authenticatedPage.getByRole("textbox", { name: /edit lesson title/i }),
    ).toBeVisible();
    const reloadedToggle = authenticatedPage.getByRole("switch");
    const reloadedLabel = authenticatedPage.locator("label").filter({ has: reloadedToggle });
    await expect(reloadedLabel.getByText(/^draft$/i)).toBeVisible();
    await expect(reloadedToggle).not.toBeChecked();
  });
});
