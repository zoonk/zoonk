import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { type Page, expect, test } from "./fixtures";

async function createTestLesson() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

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
    isPublished: true,
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

test.describe("Lesson Content Page", () => {
  test("auto-saves and persists title", async ({ authenticatedPage }) => {
    const { chapter, course, lesson } = await createTestLesson();
    await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

    const titleInput = authenticatedPage.getByRole("textbox", {
      name: /edit lesson title/i,
    });
    const uniqueTitle = `Test Title ${randomUUID().slice(0, 8)}`;

    // Clear first to ensure we're replacing, not appending
    await titleInput.clear();
    await titleInput.fill(uniqueTitle);
    // Verify the value is correct before save triggers
    await expect(titleInput).toHaveValue(uniqueTitle);
    // Wait for save to complete and indicator to disappear (ensures full save lifecycle)
    await expect(authenticatedPage.getByText(/^saved$/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/^saved$/i)).not.toBeVisible();
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.reload();
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue(uniqueTitle);
  });

  test("auto-saves and persists description", async ({ authenticatedPage }) => {
    const { chapter, course, lesson } = await createTestLesson();
    await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

    const descriptionInput = authenticatedPage.getByRole("textbox", {
      name: /edit lesson description/i,
    });
    const uniqueDescription = `Test Description ${randomUUID().slice(0, 8)}`;

    // Clear first to ensure we're replacing, not appending
    await descriptionInput.clear();
    await descriptionInput.fill(uniqueDescription);
    // Verify the value is correct before save triggers
    await expect(descriptionInput).toHaveValue(uniqueDescription);
    // Wait for save to complete and indicator to disappear (ensures full save lifecycle)
    await expect(authenticatedPage.getByText(/^saved$/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/^saved$/i)).not.toBeVisible();
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.reload();
    await expect(descriptionInput).toBeVisible();
    await expect(descriptionInput).toHaveValue(uniqueDescription);
  });

  test("shows validation error for duplicate slug", async ({ authenticatedPage }) => {
    await navigateToLessonPage(
      authenticatedPage,
      "machine-learning",
      "introduction-to-machine-learning",
      "what-is-machine-learning",
    );
    const slugInput = authenticatedPage.getByRole("textbox", { name: /url address/i });

    await slugInput.fill("history-of-ml");

    await expect(authenticatedPage.getByText(/this url is already in use/i)).toBeVisible();
    await expect(
      authenticatedPage.getByRole("img", {
        name: /this url is already in use/i,
      }),
    ).toBeVisible();
  });

  test("disables save for empty slug", async ({ authenticatedPage }) => {
    await navigateToLessonPage(
      authenticatedPage,
      "machine-learning",
      "introduction-to-machine-learning",
      "what-is-machine-learning",
    );
    const slugInput = authenticatedPage.getByRole("textbox", { name: /url address/i });

    await slugInput.fill("");

    await expect(authenticatedPage.getByRole("button", { name: /^save$/i })).toBeDisabled();
  });

  test("saves valid slug and redirects", async ({ authenticatedPage }) => {
    const { chapter, course, lesson } = await createTestLesson();
    await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

    const slugInput = authenticatedPage.getByRole("textbox", { name: /url address/i });
    const uniqueSlug = `test-slug-${randomUUID().slice(0, 8)}`;

    await slugInput.fill(uniqueSlug);

    const saveButton = authenticatedPage.getByRole("button", {
      name: /^save$/i,
    });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/ai/c/en/${course.slug}/ch/${chapter.slug}/l/${uniqueSlug}`),
    );
    await expect(slugInput).toHaveValue(uniqueSlug);
  });

  test("reverts changes on cancel", async ({ authenticatedPage }) => {
    await navigateToLessonPage(
      authenticatedPage,
      "machine-learning",
      "introduction-to-machine-learning",
      "what-is-machine-learning",
    );
    const slugInput = authenticatedPage.getByRole("textbox", { name: /url address/i });

    await slugInput.fill("some-other-slug");
    await authenticatedPage.getByRole("button", { name: /cancel/i }).click();

    await expect(slugInput).toHaveValue("what-is-machine-learning");
  });

  test("saves on Enter key", async ({ authenticatedPage }) => {
    const { chapter, course, lesson } = await createTestLesson();
    await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

    const slugInput = authenticatedPage.getByRole("textbox", { name: /url address/i });
    const uniqueSlug = `enter-test-${randomUUID().slice(0, 8)}`;

    await slugInput.fill(uniqueSlug);
    await authenticatedPage.waitForLoadState("networkidle");

    const saveButton = authenticatedPage.getByRole("button", {
      name: /^save$/i,
    });
    await expect(saveButton).toBeEnabled();
    await slugInput.press("Enter");

    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/ai/c/en/${course.slug}/ch/${chapter.slug}/l/${uniqueSlug}`),
    );
  });

  test("cancels on Escape key", async ({ authenticatedPage }) => {
    await navigateToLessonPage(
      authenticatedPage,
      "machine-learning",
      "introduction-to-machine-learning",
      "what-is-machine-learning",
    );
    const slugInput = authenticatedPage.getByRole("textbox", { name: /url address/i });

    await slugInput.fill("escape-test-slug");
    await slugInput.press("Escape");

    await expect(slugInput).toHaveValue("what-is-machine-learning");
  });

  test("back link shows chapter title and navigates to chapter", async ({ authenticatedPage }) => {
    await navigateToLessonPage(
      authenticatedPage,
      "machine-learning",
      "introduction-to-machine-learning",
      "what-is-machine-learning",
    );

    const backLink = authenticatedPage.getByRole("link", {
      name: /introduction to machine learning/i,
    });
    await expect(backLink).toBeVisible();
    await backLink.click();

    await expect(authenticatedPage).toHaveURL(
      /\/ai\/c\/en\/machine-learning\/ch\/introduction-to-machine-learning$/,
    );
    await expect(
      authenticatedPage.getByRole("textbox", { name: /edit chapter title/i }),
    ).toBeVisible();
  });

  test("updated title shows in chapter lesson list after navigating back", async ({
    authenticatedPage,
  }) => {
    const { chapter, course, lesson } = await createTestLesson();
    await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

    const titleInput = authenticatedPage.getByRole("textbox", {
      name: /edit lesson title/i,
    });
    const uniqueTitle = `Updated Lesson ${randomUUID().slice(0, 8)}`;

    await titleInput.clear();
    await titleInput.fill(uniqueTitle);
    await expect(authenticatedPage.getByText(/^saved$/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/^saved$/i)).not.toBeVisible();
    await authenticatedPage.waitForLoadState("networkidle");

    // Navigate back to chapter page via back link
    const backLink = authenticatedPage.getByRole("link", {
      name: chapter.title,
    });
    await backLink.click();

    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/ai/c/en/${course.slug}/ch/${chapter.slug}$`),
    );

    // Verify the updated title shows in the lesson list
    await expect(authenticatedPage.getByText(uniqueTitle)).toBeVisible();
  });

  test("updated description shows in chapter lesson list after navigating back", async ({
    authenticatedPage,
  }) => {
    const { chapter, course, lesson } = await createTestLesson();
    await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

    const descriptionInput = authenticatedPage.getByRole("textbox", {
      name: /edit lesson description/i,
    });
    const uniqueDescription = `Updated Description ${randomUUID().slice(0, 8)}`;

    await descriptionInput.clear();
    await descriptionInput.fill(uniqueDescription);
    await expect(authenticatedPage.getByText(/^saved$/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/^saved$/i)).not.toBeVisible();
    await authenticatedPage.waitForLoadState("networkidle");

    // Navigate back to chapter page via back link
    const backLink = authenticatedPage.getByRole("link", {
      name: chapter.title,
    });
    await backLink.click();

    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/ai/c/en/${course.slug}/ch/${chapter.slug}$`),
    );

    // Verify the updated description shows in the lesson list
    // Scope to the lesson's link element since getByRole filters by visibility
    await expect(
      authenticatedPage.getByRole("link", { name: lesson.title }).getByText(uniqueDescription),
    ).toBeVisible();
  });
});
