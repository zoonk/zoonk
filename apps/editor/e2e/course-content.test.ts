import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { expect, type Page, test } from "./fixtures";

async function createTestCourse() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  return courseFixture({
    isPublished: true,
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

test.describe("Course Content Page", () => {
  test("auto-saves and persists title", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    await navigateToCoursePage(authenticatedPage, course.slug);

    const titleInput = authenticatedPage.getByRole("textbox", {
      name: /edit course title/i,
    });
    const uniqueTitle = `Test Title ${randomUUID().slice(0, 8)}`;

    await titleInput.fill(uniqueTitle);
    await expect(authenticatedPage.getByText(/^saved$/i)).toBeVisible();

    await authenticatedPage.reload();
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue(uniqueTitle);
  });

  test("auto-saves and persists description", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    await navigateToCoursePage(authenticatedPage, course.slug);

    const descriptionInput = authenticatedPage.getByRole("textbox", {
      name: /edit course description/i,
    });
    const uniqueDescription = `Test Description ${randomUUID().slice(0, 8)}`;

    await descriptionInput.fill(uniqueDescription);
    await expect(authenticatedPage.getByText(/^saved$/i)).toBeVisible();

    await authenticatedPage.reload();
    await expect(descriptionInput).toBeVisible();
    await expect(descriptionInput).toHaveValue(uniqueDescription);
  });

  test("shows validation error for duplicate slug", async ({
    authenticatedPage,
  }) => {
    await navigateToCoursePage(authenticatedPage, "machine-learning");
    const slugInput = authenticatedPage.getByLabel(/url address/i);

    await slugInput.fill("spanish");

    await expect(
      authenticatedPage.getByText(/this url is already in use/i),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("img", {
        name: /this url is already in use/i,
      }),
    ).toBeVisible();
  });

  test("disables save for empty slug", async ({ authenticatedPage }) => {
    await navigateToCoursePage(authenticatedPage, "machine-learning");
    const slugInput = authenticatedPage.getByLabel(/url address/i);

    await slugInput.fill("");

    await expect(
      authenticatedPage.getByRole("button", { name: /^save$/i }),
    ).not.toBeVisible();
  });

  test("saves valid slug and redirects", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    await navigateToCoursePage(authenticatedPage, course.slug);

    const slugInput = authenticatedPage.getByLabel(/url address/i);
    const uniqueSlug = `test-slug-${randomUUID().slice(0, 8)}`;

    await slugInput.fill(uniqueSlug);

    const saveButton = authenticatedPage.getByRole("button", {
      name: /^save$/i,
    });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/ai/c/en/${uniqueSlug}`),
    );
    await expect(slugInput).toHaveValue(uniqueSlug);
  });

  test("reverts changes on cancel", async ({ authenticatedPage }) => {
    await navigateToCoursePage(authenticatedPage, "machine-learning");
    const slugInput = authenticatedPage.getByLabel(/url address/i);

    await slugInput.fill("some-other-slug");
    await authenticatedPage.getByRole("button", { name: /cancel/i }).click();

    await expect(slugInput).toHaveValue("machine-learning");
  });

  test("saves on Enter key", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    await navigateToCoursePage(authenticatedPage, course.slug);

    const slugInput = authenticatedPage.getByLabel(/url address/i);
    const uniqueSlug = `enter-test-${randomUUID().slice(0, 8)}`;

    await slugInput.fill(uniqueSlug);
    await authenticatedPage.waitForLoadState("networkidle");

    const saveButton = authenticatedPage.getByRole("button", {
      name: /^save$/i,
    });
    await expect(saveButton).toBeEnabled();
    await slugInput.press("Enter");

    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/ai/c/en/${uniqueSlug}`),
    );
  });

  test("cancels on Escape key", async ({ authenticatedPage }) => {
    await navigateToCoursePage(authenticatedPage, "machine-learning");
    const slugInput = authenticatedPage.getByLabel(/url address/i);

    await slugInput.fill("escape-test-slug");
    await slugInput.press("Escape");

    await expect(slugInput).toHaveValue("machine-learning");
  });
});
