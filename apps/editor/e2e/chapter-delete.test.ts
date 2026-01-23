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
    slug: `e2e-course-${randomUUID().slice(0, 8)}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished,
    language: course.language,
    organizationId: org.id,
    slug: `e2e-chapter-${randomUUID().slice(0, 8)}`,
  });

  return { chapter, course };
}

async function navigateToChapterPage(page: Page, courseSlug: string, chapterSlug: string) {
  await page.goto(`/ai/c/en/${courseSlug}/ch/${chapterSlug}`);

  await expect(page.getByRole("textbox", { name: /edit chapter title/i })).toBeVisible();
}

function getDeleteButton(page: Page) {
  return page.getByRole("button", { name: /delete chapter/i });
}

function getDeleteDialog(page: Page) {
  return page.getByRole("alertdialog");
}

function getCancelButton(page: Page) {
  return page.getByRole("button", { name: /cancel/i });
}

function getConfirmDeleteButton(page: Page) {
  return page.getByRole("button", { name: /^delete$/i });
}

async function openDeleteDialog(page: Page) {
  await getDeleteButton(page).click();
  await expect(getDeleteDialog(page)).toBeVisible();
}

async function confirmDelete(page: Page) {
  await getConfirmDeleteButton(page).click();
}

async function verifyChapterDeleted(chapterId: number) {
  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
  expect(chapter).toBeNull();
}

async function verifyChapterExists(chapterId: number) {
  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
  expect(chapter).not.toBeNull();
}

test.describe("Chapter Delete", () => {
  test.describe("Happy Path", () => {
    test("admin deletes unpublished chapter", async ({ authenticatedPage }) => {
      const { course, chapter } = await createTestChapter(false);
      await navigateToChapterPage(authenticatedPage, course.slug, chapter.slug);

      await expect(getDeleteButton(authenticatedPage)).toBeVisible();
      await openDeleteDialog(authenticatedPage);
      await confirmDelete(authenticatedPage);

      await expect(authenticatedPage).toHaveURL(new RegExp(`/ai/c/en/${course.slug}$`));
      await verifyChapterDeleted(chapter.id);
    });

    test("owner deletes unpublished chapter", async ({ ownerPage }) => {
      const { course, chapter } = await createTestChapter(false);
      await navigateToChapterPage(ownerPage, course.slug, chapter.slug);

      await openDeleteDialog(ownerPage);
      await confirmDelete(ownerPage);

      await expect(ownerPage).toHaveURL(new RegExp(`/ai/c/en/${course.slug}$`));
      await verifyChapterDeleted(chapter.id);
    });

    test("owner deletes published chapter", async ({ ownerPage }) => {
      const { course, chapter } = await createTestChapter(true);
      await navigateToChapterPage(ownerPage, course.slug, chapter.slug);

      await openDeleteDialog(ownerPage);
      await confirmDelete(ownerPage);

      await expect(ownerPage).toHaveURL(new RegExp(`/ai/c/en/${course.slug}$`));
      await verifyChapterDeleted(chapter.id);
    });
  });

  test.describe("Permissions", () => {
    test("admin cannot see delete button for published chapter", async ({ authenticatedPage }) => {
      const { course, chapter } = await createTestChapter(true);
      await navigateToChapterPage(authenticatedPage, course.slug, chapter.slug);

      await expect(getDeleteButton(authenticatedPage)).not.toBeVisible();
      await verifyChapterExists(chapter.id);
    });
  });

  test.describe("Dialog Interaction", () => {
    test("cancel button closes dialog without deleting", async ({ authenticatedPage }) => {
      const { course, chapter } = await createTestChapter(false);
      await navigateToChapterPage(authenticatedPage, course.slug, chapter.slug);

      await openDeleteDialog(authenticatedPage);
      await getCancelButton(authenticatedPage).click();

      await expect(getDeleteDialog(authenticatedPage)).not.toBeVisible();
      await verifyChapterExists(chapter.id);
    });

    test("escape key closes dialog without deleting", async ({ authenticatedPage }) => {
      const { course, chapter } = await createTestChapter(false);
      await navigateToChapterPage(authenticatedPage, course.slug, chapter.slug);

      await openDeleteDialog(authenticatedPage);
      await authenticatedPage.keyboard.press("Escape");

      await expect(getDeleteDialog(authenticatedPage)).not.toBeVisible();
      await verifyChapterExists(chapter.id);
    });
  });
});
