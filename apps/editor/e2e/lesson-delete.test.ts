import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getAiOrganization, openDialog } from "@zoonk/e2e/helpers";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { type Page, expect, test } from "./fixtures";

async function createTestLesson(isPublished: boolean) {
  const org = await getAiOrganization();

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-course-${randomUUID().slice(0, 8)}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    language: course.language,
    organizationId: org.id,
    slug: `e2e-chapter-${randomUUID().slice(0, 8)}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished,
    language: course.language,
    organizationId: org.id,
    slug: `e2e-lesson-${randomUUID().slice(0, 8)}`,
  });

  return { chapter, course, lesson };
}

async function navigateToLessonPage(
  page: Page,
  courseSlug: string,
  chapterSlug: string,
  lessonSlug: string,
) {
  await page.goto(`/${AI_ORG_SLUG}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`);

  await expect(page.getByRole("textbox", { name: /edit lesson title/i })).toBeVisible();
}

function getDeleteButton(page: Page) {
  return page.getByRole("button", { name: /delete lesson/i });
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
  await openDialog(getDeleteButton(page), getDeleteDialog(page));
}

async function confirmDelete(page: Page) {
  await getConfirmDeleteButton(page).click();
}

async function verifyLessonDeleted(lessonId: number) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  expect(lesson).toBeNull();
}

async function verifyLessonExists(lessonId: number) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  expect(lesson).not.toBeNull();
}

test.describe("Lesson Delete", () => {
  test.describe("Happy Path", () => {
    test("admin deletes unpublished lesson", async ({ authenticatedPage }) => {
      const { course, chapter, lesson } = await createTestLesson(false);
      await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

      await expect(getDeleteButton(authenticatedPage)).toBeVisible();
      await openDeleteDialog(authenticatedPage);
      await confirmDelete(authenticatedPage);

      await expect(authenticatedPage).toHaveURL(
        new RegExp(`/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}$`),
      );
      await verifyLessonDeleted(lesson.id);
    });

    test("owner deletes unpublished lesson", async ({ ownerPage }) => {
      const { course, chapter, lesson } = await createTestLesson(false);
      await navigateToLessonPage(ownerPage, course.slug, chapter.slug, lesson.slug);

      await openDeleteDialog(ownerPage);
      await confirmDelete(ownerPage);

      await expect(ownerPage).toHaveURL(
        new RegExp(`/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}$`),
      );
      await verifyLessonDeleted(lesson.id);
    });

    test("owner deletes published lesson", async ({ ownerPage }) => {
      const { course, chapter, lesson } = await createTestLesson(true);
      await navigateToLessonPage(ownerPage, course.slug, chapter.slug, lesson.slug);

      await openDeleteDialog(ownerPage);
      await confirmDelete(ownerPage);

      await expect(ownerPage).toHaveURL(
        new RegExp(`/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}$`),
      );
      await verifyLessonDeleted(lesson.id);
    });
  });

  test.describe("Permissions", () => {
    test("admin cannot see delete button for published lesson", async ({ authenticatedPage }) => {
      const { course, chapter, lesson } = await createTestLesson(true);
      await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

      await expect(getDeleteButton(authenticatedPage)).not.toBeVisible();
      await verifyLessonExists(lesson.id);
    });
  });

  test.describe("Dialog Interaction", () => {
    test("cancel button closes dialog without deleting", async ({ authenticatedPage }) => {
      const { course, chapter, lesson } = await createTestLesson(false);
      await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

      await openDeleteDialog(authenticatedPage);
      await getCancelButton(authenticatedPage).click();

      await expect(getDeleteDialog(authenticatedPage)).not.toBeVisible();
      await verifyLessonExists(lesson.id);
    });

    test("escape key closes dialog without deleting", async ({ authenticatedPage }) => {
      const { course, chapter, lesson } = await createTestLesson(false);
      await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

      await openDeleteDialog(authenticatedPage);
      await authenticatedPage.keyboard.press("Escape");

      await expect(getDeleteDialog(authenticatedPage)).not.toBeVisible();
      await verifyLessonExists(lesson.id);
    });
  });
});
