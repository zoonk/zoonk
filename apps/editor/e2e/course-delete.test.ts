import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getAiOrganization, openDialog } from "@zoonk/e2e/helpers";
import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type Page, expect, test } from "./fixtures";

async function createTestCourse(isPublished: boolean) {
  const org = await getAiOrganization();

  return courseFixture({
    isPublished,
    organizationId: org.id,
    slug: `e2e-${randomUUID().slice(0, 8)}`,
  });
}

async function createLearnerTouchedCourse() {
  const org = await getAiOrganization();
  const course = await createTestCourse(false);
  const chapter = await chapterFixture({
    courseId: course.id,
    language: course.language,
    organizationId: org.id,
    slug: `e2e-chapter-${randomUUID().slice(0, 8)}`,
  });
  const lesson = await lessonFixture({
    chapterId: chapter.id,
    language: chapter.language,
    organizationId: org.id,
    slug: `e2e-lesson-${randomUUID().slice(0, 8)}`,
  });
  const activity = await activityFixture({
    lessonId: lesson.id,
    organizationId: org.id,
  });
  const user = await prisma.user.create({
    data: {
      email: `e2e-delete-${randomUUID().slice(0, 8)}@example.test`,
      emailVerified: true,
      name: "E2E Delete User",
    },
  });

  await activityProgressFixture({
    activityId: activity.id,
    completedAt: new Date(),
    durationSeconds: 30,
    userId: user.id,
  });

  return course;
}

async function navigateToCoursePage(page: Page, slug: string) {
  await page.goto(`/${AI_ORG_SLUG}/c/${slug}`);

  await expect(page.getByRole("textbox", { name: /edit course title/i })).toBeVisible();
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
  await openDialog(getDeleteButton(page), getDeleteDialog(page));
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

async function verifyCourseArchived(courseId: number) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  expect(course).not.toBeNull();
  expect(course?.archivedAt).not.toBeNull();
}

test.describe("Course Delete", () => {
  test.describe("Happy Path", () => {
    test("admin deletes unpublished course", async ({ authenticatedPage }) => {
      const course = await createTestCourse(false);
      await navigateToCoursePage(authenticatedPage, course.slug);

      await expect(getDeleteButton(authenticatedPage)).toBeVisible();
      await openDeleteDialog(authenticatedPage);
      await confirmDelete(authenticatedPage);

      await expect(authenticatedPage).toHaveURL(new RegExp(`/${AI_ORG_SLUG}$`));
      await verifyCourseDeleted(course.id);
    });

    test("owner deletes unpublished course", async ({ ownerPage }) => {
      const course = await createTestCourse(false);
      await navigateToCoursePage(ownerPage, course.slug);

      await openDeleteDialog(ownerPage);
      await confirmDelete(ownerPage);

      await expect(ownerPage).toHaveURL(new RegExp(`/${AI_ORG_SLUG}$`));
      await verifyCourseDeleted(course.id);
    });

    test("owner deletes published course", async ({ ownerPage }) => {
      const course = await createTestCourse(true);
      await navigateToCoursePage(ownerPage, course.slug);

      await openDeleteDialog(ownerPage);
      await confirmDelete(ownerPage);

      await expect(ownerPage).toHaveURL(new RegExp(`/${AI_ORG_SLUG}$`));
      await verifyCourseDeleted(course.id);
    });

    test("admin archives learner-touched unpublished course without an error", async ({
      authenticatedPage,
    }) => {
      const course = await createLearnerTouchedCourse();
      await navigateToCoursePage(authenticatedPage, course.slug);

      await expect(getDeleteButton(authenticatedPage)).toBeVisible();
      await openDeleteDialog(authenticatedPage);
      await confirmDelete(authenticatedPage);

      await expect(authenticatedPage).toHaveURL(new RegExp(`/${AI_ORG_SLUG}$`));
      await verifyCourseArchived(course.id);
    });
  });

  test.describe("Permissions", () => {
    test("admin cannot see delete button for published course", async ({ authenticatedPage }) => {
      const course = await createTestCourse(true);
      await navigateToCoursePage(authenticatedPage, course.slug);

      await expect(getDeleteButton(authenticatedPage)).not.toBeVisible();
      await verifyCourseExists(course.id);
    });
  });

  test.describe("Dialog Interaction", () => {
    test("cancel button closes dialog without deleting", async ({ authenticatedPage }) => {
      const course = await createTestCourse(false);
      await navigateToCoursePage(authenticatedPage, course.slug);

      await openDeleteDialog(authenticatedPage);
      await getCancelButton(authenticatedPage).click();

      await expect(getDeleteDialog(authenticatedPage)).not.toBeVisible();
      await verifyCourseExists(course.id);
    });

    test("escape key closes dialog without deleting", async ({ authenticatedPage }) => {
      const course = await createTestCourse(false);
      await navigateToCoursePage(authenticatedPage, course.slug);

      await openDeleteDialog(authenticatedPage);
      await authenticatedPage.keyboard.press("Escape");

      await expect(getDeleteDialog(authenticatedPage)).not.toBeVisible();
      await verifyCourseExists(course.id);
    });
  });
});
