import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { expect, type Page, test } from "./fixtures";

async function createTestChapter(isPublished: boolean) {
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
    isPublished,
    organizationId: org.id,
    slug: `e2e-${randomUUID().slice(0, 8)}`,
  });

  return { chapter, course };
}

async function navigateToChapterPage(
  page: Page,
  courseSlug: string,
  chapterSlug: string,
) {
  await page.goto(`/ai/c/en/${courseSlug}/ch/${chapterSlug}`);

  await expect(
    page.getByRole("textbox", { name: /edit chapter title/i }),
  ).toBeVisible();
}

test.describe("Chapter Publish Toggle", () => {
  test("displays Draft for unpublished chapter", async ({
    authenticatedPage,
  }) => {
    const { course, chapter } = await createTestChapter(false);
    await navigateToChapterPage(authenticatedPage, course.slug, chapter.slug);

    await expect(authenticatedPage.getByText(/^draft$/i)).toBeVisible();
    await expect(authenticatedPage.getByRole("switch")).not.toBeChecked();
  });

  test("displays Published for published chapter", async ({
    authenticatedPage,
  }) => {
    const { course, chapter } = await createTestChapter(true);
    await navigateToChapterPage(authenticatedPage, course.slug, chapter.slug);

    await expect(authenticatedPage.getByText(/^published$/i)).toBeVisible();
    await expect(authenticatedPage.getByRole("switch")).toBeChecked();
  });

  test("publishes a draft chapter and persists", async ({
    authenticatedPage,
  }) => {
    const { course, chapter } = await createTestChapter(false);
    await navigateToChapterPage(authenticatedPage, course.slug, chapter.slug);

    await expect(authenticatedPage.getByText(/^draft$/i)).toBeVisible();

    const toggle = authenticatedPage.getByRole("switch");
    await expect(toggle).toBeEnabled();
    await expect(toggle).not.toBeChecked();

    await toggle.click();

    await expect(authenticatedPage.getByText(/^published$/i)).toBeVisible();
    await expect(toggle).toBeChecked();

    // Wait for the server action to complete (switch re-enables after transition)
    await expect(toggle).toBeEnabled();

    await authenticatedPage.reload();

    await expect(
      authenticatedPage.getByRole("textbox", { name: /edit chapter title/i }),
    ).toBeVisible();
    await expect(authenticatedPage.getByText(/^published$/i)).toBeVisible();
    await expect(authenticatedPage.getByRole("switch")).toBeChecked();
  });

  test("unpublishes a published chapter and persists", async ({
    authenticatedPage,
  }) => {
    const { course, chapter } = await createTestChapter(true);
    await navigateToChapterPage(authenticatedPage, course.slug, chapter.slug);

    await expect(authenticatedPage.getByText(/^published$/i)).toBeVisible();

    const toggle = authenticatedPage.getByRole("switch");
    await expect(toggle).toBeEnabled();
    await expect(toggle).toBeChecked();

    await toggle.click();

    await expect(authenticatedPage.getByText(/^draft$/i)).toBeVisible();
    await expect(toggle).not.toBeChecked();

    // Wait for the server action to complete (switch re-enables after transition)
    await expect(toggle).toBeEnabled();

    await authenticatedPage.reload();

    await expect(
      authenticatedPage.getByRole("textbox", { name: /edit chapter title/i }),
    ).toBeVisible();
    await expect(authenticatedPage.getByText(/^draft$/i)).toBeVisible();
    await expect(authenticatedPage.getByRole("switch")).not.toBeChecked();
  });
});
