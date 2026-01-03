import { expect, test } from "./fixtures";

test.describe("Courses Page - Basic", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/courses");
  });

  test("shows page title", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /explore courses/i }),
    ).toBeVisible();
  });

  test("shows page description", async ({ page }) => {
    await expect(
      page.getByText(/start learning something new today/i),
    ).toBeVisible();
  });

  test("shows course list with course cards", async ({ page }) => {
    // Should show at least one course from seed data
    await expect(page.getByText("Machine Learning").first()).toBeVisible();
  });

  test("course cards show title and description", async ({ page }) => {
    // Machine Learning course should be visible with its description
    await expect(page.getByText("Machine Learning").first()).toBeVisible();
    await expect(
      page.getByText(/patterns|predictions|data|computers|identify/i).first(),
    ).toBeVisible();
  });

  test("clicking course card shows course detail page", async ({ page }) => {
    await page.getByText("Machine Learning").first().click();

    // Verify user sees course detail page with course content
    await expect(
      page.getByRole("heading", { name: /machine learning/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/patterns|predictions|data|computers|identify/i).first(),
    ).toBeVisible();
  });
});

test.describe("Courses Page - Infinite Scroll", () => {
  test("loads initial courses", async ({ page }) => {
    await page.goto("/courses");

    // Should have multiple courses visible from seed data
    await expect(page.getByText("Machine Learning").first()).toBeVisible();
    await expect(page.getByText("Spanish").first()).toBeVisible();
  });

  test("handles end of course list gracefully", async ({ page }) => {
    await page.goto("/courses");

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for any loading to complete
    await page.waitForTimeout(1000);

    // Should still show existing courses without errors
    await expect(page.getByText("Machine Learning").first()).toBeVisible();
  });
});

test.describe("Courses Page - Locale", () => {
  test("English courses show on /courses (no prefix)", async ({ page }) => {
    await page.goto("/courses");

    // English courses should be visible
    await expect(page.getByText("Machine Learning").first()).toBeVisible();
    await expect(page.getByText("Spanish").first()).toBeVisible();
    await expect(page.getByText("Astronomy").first()).toBeVisible();
  });

  test("Portuguese courses show on /pt/courses", async ({ page }) => {
    await page.goto("/pt/courses");

    // Portuguese courses should be visible
    await expect(page.getByText("Machine Learning").first()).toBeVisible(); // Same title in PT
    await expect(page.getByText("Espanhol").first()).toBeVisible();
  });

  test("unpublished courses are hidden", async ({ page }) => {
    await page.goto("/pt/courses");

    // Astronomia is unpublished in PT and should NOT be visible
    await expect(page.getByText("Astronomia")).not.toBeVisible();
  });

  test("page content is in Portuguese on /pt/courses", async ({ page }) => {
    await page.goto("/pt/courses");

    // Page title should be translated
    await expect(
      page.getByRole("heading", { name: /explorar cursos/i }),
    ).toBeVisible();
  });
});
