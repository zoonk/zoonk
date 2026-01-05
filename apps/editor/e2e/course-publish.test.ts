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

test.describe("Course Publish Toggle", () => {
  test("displays Draft for unpublished course", async ({
    authenticatedPage,
  }) => {
    const course = await createTestCourse(false);
    await navigateToCoursePage(authenticatedPage, course.slug);

    await expect(authenticatedPage.getByText(/^draft$/i)).toBeVisible();
    await expect(authenticatedPage.getByRole("switch")).not.toBeChecked();
  });

  test("displays Published for published course", async ({
    authenticatedPage,
  }) => {
    const course = await createTestCourse(true);
    await navigateToCoursePage(authenticatedPage, course.slug);

    await expect(authenticatedPage.getByText(/^published$/i)).toBeVisible();
    await expect(authenticatedPage.getByRole("switch")).toBeChecked();
  });

  test("publishes a draft course and persists", async ({
    authenticatedPage,
  }) => {
    const course = await createTestCourse(false);
    await navigateToCoursePage(authenticatedPage, course.slug);

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
      authenticatedPage.getByRole("textbox", { name: /edit course title/i }),
    ).toBeVisible();
    await expect(authenticatedPage.getByText(/^published$/i)).toBeVisible();
    await expect(authenticatedPage.getByRole("switch")).toBeChecked();
  });

  test("unpublishes a published course and persists", async ({
    authenticatedPage,
  }) => {
    const course = await createTestCourse(true);
    await navigateToCoursePage(authenticatedPage, course.slug);

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
      authenticatedPage.getByRole("textbox", { name: /edit course title/i }),
    ).toBeVisible();
    await expect(authenticatedPage.getByText(/^draft$/i)).toBeVisible();
    await expect(authenticatedPage.getByRole("switch")).not.toBeChecked();
  });
});
