import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { type Page, expect, test } from "./fixtures";

let slugCourseSlug: string;
let duplicateTargetSlug: string;

async function createTestCourse() {
  const org = await getAiOrganization();

  return courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-${randomUUID().slice(0, 8)}`,
  });
}

async function navigateToCoursePage(page: Page, slug: string) {
  await page.goto(`/${AI_ORG_SLUG}/c/en/${slug}`);

  await expect(page.getByRole("textbox", { name: /edit course title/i })).toBeVisible();
}

test.beforeAll(async () => {
  const org = await getAiOrganization();

  const [slugCourse, duplicateTarget] = await Promise.all([
    courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-slug-${randomUUID().slice(0, 8)}`,
    }),
    courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-dup-${randomUUID().slice(0, 8)}`,
    }),
  ]);

  slugCourseSlug = slugCourse.slug;
  duplicateTargetSlug = duplicateTarget.slug;
});

test.describe("Course Content Page", () => {
  test("auto-saves and persists title", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    await navigateToCoursePage(authenticatedPage, course.slug);

    const titleInput = authenticatedPage.getByRole("textbox", {
      name: /edit course title/i,
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
    const course = await createTestCourse();
    await navigateToCoursePage(authenticatedPage, course.slug);

    const descriptionInput = authenticatedPage.getByRole("textbox", {
      name: /edit course description/i,
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
    await navigateToCoursePage(authenticatedPage, slugCourseSlug);
    const slugInput = authenticatedPage.getByRole("textbox", { name: /url address/i });

    await slugInput.fill(duplicateTargetSlug);

    await expect(authenticatedPage.getByText(/this url is already in use/i)).toBeVisible();
    await expect(
      authenticatedPage.getByRole("img", {
        name: /this url is already in use/i,
      }),
    ).toBeVisible();
  });

  test("disables save for empty slug", async ({ authenticatedPage }) => {
    await navigateToCoursePage(authenticatedPage, slugCourseSlug);
    const slugInput = authenticatedPage.getByRole("textbox", { name: /url address/i });

    await slugInput.fill("");

    await expect(authenticatedPage.getByRole("button", { name: /^save$/i })).toBeDisabled();
  });

  test("saves valid slug and redirects", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    await navigateToCoursePage(authenticatedPage, course.slug);

    const slugInput = authenticatedPage.getByRole("textbox", { name: /url address/i });
    const uniqueSlug = `test-slug-${randomUUID().slice(0, 8)}`;

    await slugInput.fill(uniqueSlug);

    const saveButton = authenticatedPage.getByRole("button", {
      name: /^save$/i,
    });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(authenticatedPage).toHaveURL(new RegExp(`/${AI_ORG_SLUG}/c/en/${uniqueSlug}`));
    await expect(slugInput).toHaveValue(uniqueSlug);
  });

  test("reverts changes on cancel", async ({ authenticatedPage }) => {
    await navigateToCoursePage(authenticatedPage, slugCourseSlug);
    const slugInput = authenticatedPage.getByRole("textbox", { name: /url address/i });

    await slugInput.fill("some-other-slug");
    await authenticatedPage.getByRole("button", { name: /cancel/i }).click();

    await expect(slugInput).toHaveValue(slugCourseSlug);
  });

  test("saves on Enter key", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    await navigateToCoursePage(authenticatedPage, course.slug);

    const slugInput = authenticatedPage.getByRole("textbox", { name: /url address/i });
    const uniqueSlug = `enter-test-${randomUUID().slice(0, 8)}`;

    await slugInput.fill(uniqueSlug);
    await authenticatedPage.waitForLoadState("networkidle");

    const saveButton = authenticatedPage.getByRole("button", {
      name: /^save$/i,
    });
    await expect(saveButton).toBeEnabled();
    await slugInput.press("Enter");

    await expect(authenticatedPage).toHaveURL(new RegExp(`/${AI_ORG_SLUG}/c/en/${uniqueSlug}`));
  });

  test("cancels on Escape key", async ({ authenticatedPage }) => {
    await navigateToCoursePage(authenticatedPage, slugCourseSlug);
    const slugInput = authenticatedPage.getByRole("textbox", { name: /url address/i });

    await slugInput.fill("escape-test-slug");
    await slugInput.press("Escape");

    await expect(slugInput).toHaveValue(slugCourseSlug);
  });
});
