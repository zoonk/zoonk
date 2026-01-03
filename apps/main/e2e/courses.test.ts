import { expect, test } from "./fixtures";

test.describe("Courses Page - Basic", () => {
  test("shows page content with course cards", async ({ page }) => {
    await page.goto("/courses");

    // Page title and description
    await expect(
      page.getByRole("heading", { name: /explore courses/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/start learning something new today/i),
    ).toBeVisible();

    // Multiple courses should be visible from seed data
    await expect(page.getByText("Machine Learning").first()).toBeVisible();
    await expect(page.getByText("Spanish").first()).toBeVisible();
  });

  test("clicking course card navigates to course detail", async ({ page }) => {
    await page.goto("/courses");

    await page.getByText("Machine Learning").first().click();

    // Verify user sees course detail page
    await expect(
      page.getByRole("heading", { name: /machine learning/i }),
    ).toBeVisible();
  });
});

test.describe("Courses Page - Locale", () => {
  test("Portuguese locale shows translated content", async ({ page }) => {
    await page.goto("/pt/courses");

    // Page title should be translated
    await expect(
      page.getByRole("heading", { name: /explorar cursos/i }),
    ).toBeVisible();

    // Portuguese courses should be visible
    await expect(page.getByText("Machine Learning").first()).toBeVisible();
    await expect(page.getByText("Espanhol").first()).toBeVisible();
  });

  test("unpublished courses are hidden", async ({ page }) => {
    await page.goto("/pt/courses");

    // Astronomia is unpublished in PT and should NOT be visible
    await expect(page.getByText("Astronomia")).not.toBeVisible();
  });
});
