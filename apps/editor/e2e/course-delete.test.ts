import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { expect, type Page, test } from "./fixtures";

async function createTestCourse(isPublished: boolean) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  return courseFixture({
    isPublished,
    organizationId: org.id,
    slug: `e2e-${randomUUID().slice(0, 8)}`,
  });
}

async function navigateToCoursePage(page: Page, slug: string) {
  await page.goto(`/ai/c/en/${slug}`);

  await expect(
    page.getByRole("textbox", { name: /edit course title/i }),
  ).toBeVisible();
}

function getDeleteButton(page: Page) {
  return page.getByRole("button", { name: /delete course/i });
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

async function verifyCourseDeleted(courseId: number) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  expect(course).toBeNull();
}

async function verifyCourseExists(courseId: number) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  expect(course).not.toBeNull();
}

test.describe("Course Delete", () => {
  test.describe("Happy Path", () => {
    test("admin deletes unpublished course", async ({ authenticatedPage }) => {
      const course = await createTestCourse(false);
      await navigateToCoursePage(authenticatedPage, course.slug);

      await expect(getDeleteButton(authenticatedPage)).toBeVisible();
      await openDeleteDialog(authenticatedPage);
      await confirmDelete(authenticatedPage);

      await expect(authenticatedPage).toHaveURL(/\/ai$/);
      await verifyCourseDeleted(course.id);
    });

    test("owner deletes unpublished course", async ({ ownerPage }) => {
      const course = await createTestCourse(false);
      await navigateToCoursePage(ownerPage, course.slug);

      await openDeleteDialog(ownerPage);
      await confirmDelete(ownerPage);

      await expect(ownerPage).toHaveURL(/\/ai$/);
      await verifyCourseDeleted(course.id);
    });

    test("owner deletes published course", async ({ ownerPage }) => {
      const course = await createTestCourse(true);
      await navigateToCoursePage(ownerPage, course.slug);

      await openDeleteDialog(ownerPage);
      await confirmDelete(ownerPage);

      await expect(ownerPage).toHaveURL(/\/ai$/);
      await verifyCourseDeleted(course.id);
    });
  });

  test.describe("Permissions", () => {
    test("admin cannot see delete button for published course", async ({
      authenticatedPage,
    }) => {
      const course = await createTestCourse(true);
      await navigateToCoursePage(authenticatedPage, course.slug);

      await expect(getDeleteButton(authenticatedPage)).not.toBeVisible();
      await verifyCourseExists(course.id);
    });
  });

  test.describe("Dialog Interaction", () => {
    test("cancel button closes dialog without deleting", async ({
      authenticatedPage,
    }) => {
      const course = await createTestCourse(false);
      await navigateToCoursePage(authenticatedPage, course.slug);

      await openDeleteDialog(authenticatedPage);
      await getCancelButton(authenticatedPage).click();

      await expect(getDeleteDialog(authenticatedPage)).not.toBeVisible();
      await verifyCourseExists(course.id);
    });

    test("escape key closes dialog without deleting", async ({
      authenticatedPage,
    }) => {
      const course = await createTestCourse(false);
      await navigateToCoursePage(authenticatedPage, course.slug);

      await openDeleteDialog(authenticatedPage);
      await authenticatedPage.keyboard.press("Escape");

      await expect(getDeleteDialog(authenticatedPage)).not.toBeVisible();
      await verifyCourseExists(course.id);
    });
  });
});
